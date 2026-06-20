"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Area, AreaChart, BarChart, Bar
} from "recharts";
import { supabase } from "../../lib/supabase";

export default function AnalyticsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [timeRange, setTimeRange] = useState("This Year");

    // KPI States
    const [kpis, setKpis] = useState({
        totalShops: 0,
        activeShops: 0,
        pendingShops: 0,
        totalGmv: 0,
        expiryLossPrevented: 0
    });

    // Chart States
    const [registrationData, setRegistrationData] = useState<any[]>([]);
    const [salesData, setSalesData] = useState<any[]>([]);
    const [topShops, setTopShops] = useState<any[]>([]);
    const [stateData, setStateData] = useState<any[]>([]);

    useEffect(() => {
        fetchAnalyticsData();
    }, [timeRange]);

    const fetchAnalyticsData = async () => {
        try {
            setIsLoading(true);

            // Time filtering logic
            const now = new Date();
            let startDate = new Date("2000-01-01"); // Default: All time
            if (timeRange === "This Year") {
                startDate = new Date(now.getFullYear(), 0, 1);
            } else if (timeRange === "This Month") {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }

            // 1. Fetch raw data from API
            const res = await fetch(`/api/admin/analytics?startDate=${startDate.toISOString()}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            const { totalCount, activeCount, pendingCount, shops, bills } = data;

            // --- BULLETPROOF STATUS FILTERING ---
            // We fetch the ground-truth statuses directly from Supabase to guarantee 
            // the API payload doesn't break our filtering.
            const { data: statusData } = await supabase.from('shops').select('id, status');

            let validShops = shops || [];
            let validBills = bills || [];

            if (statusData && statusData.length > 0) {
                // Map out ONLY the IDs of shops that are Active or Suspended
                const validShopIds = new Set(
                    statusData
                        .filter(s => s.status === 'ACTIVE' || s.status === 'SUSPENDED')
                        .map(s => s.id)
                );

                // Scrub rejected/pending shops and their bills from the data
                validShops = validShops.filter((s: any) => validShopIds.has(s.id));
                validBills = validBills.filter((b: any) => validShopIds.has(b.shop_id));
            }

            // 2. Process KPIs (Using sanitized validBills & validShops)
            const totalRevenue = validBills.reduce((sum: number, bill: any) => sum + Number(bill.total_amount), 0) || 0;
            const estimatedExpirySavings = totalRevenue * 0.025;

            setKpis({
                totalShops: validShops.length, // Only count verified shops in the total
                activeShops: activeCount || 0,
                pendingShops: pendingCount || 0, // Keep this raw so your "Pending KYC" widget still works
                totalGmv: totalRevenue,
                expiryLossPrevented: estimatedExpirySavings
            });

            // 3. Process Registration Growth Chart
            const regMap: Record<string, number> = {};
            validShops.forEach((shop: any) => {
                const date = new Date(shop.created_at);
                const month = date.toLocaleString('default', { month: 'short' });
                regMap[month] = (regMap[month] || 0) + 1;
            });

            const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const formattedRegData = monthsOrder
                .filter(m => regMap[m] !== undefined)
                .map(m => ({ month: m, registrations: regMap[m] }));

            setRegistrationData(formattedRegData.length > 0 ? formattedRegData : [{ month: 'No Data', registrations: 0 }]);

            // 4. Process Sales Chart (Daily grouping)
            const salesMap: Record<string, number> = {};
            validBills.forEach((bill: any) => {
                const date = new Date(bill.created_at);
                const day = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
                salesMap[day] = (salesMap[day] || 0) + Number(bill.total_amount);
            });

            const formattedSalesData = Object.keys(salesMap)
                .sort()
                .map(day => ({ day, sales: salesMap[day] }));

            setSalesData(formattedSalesData.length > 0 ? formattedSalesData : [{ day: 'No Data', sales: 0 }]);

            // 5. Process Top Shops Leaderboard
            if (validShops.length > 0 && validBills.length > 0) {
                const shopSalesMap: Record<string, { name: string, total: number }> = {};

                validShops.forEach((s: any) => shopSalesMap[s.id] = { name: s.name, total: 0 });

                validBills.forEach((b: any) => {
                    if (!shopSalesMap[b.shop_id]) {
                        shopSalesMap[b.shop_id] = { name: "Deleted/Unknown Shop", total: 0 };
                    }
                    shopSalesMap[b.shop_id].total += Number(b.total_amount);
                });

                const top = Object.values(shopSalesMap)
                    .filter(s => s.total > 0)
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 5)
                    .map(s => ({
                        name: s.name.substring(0, 15) + (s.name.length > 15 ? '...' : ''),
                        val: s.total,
                        percentage: totalRevenue > 0 ? (s.total / totalRevenue) * 100 : 0
                    }));

                setTopShops(top);
            } else {
                setTopShops([]);
            }

            // 6. TRUE State Distribution Parsing (Using validShops)
            const cityToState: Record<string, string> = {
                "kolkata": "West Bengal", "mumbai": "Maharashtra", "pune": "Maharashtra",
                "bangalore": "Karnataka", "chennai": "Tamil Nadu", "hyderabad": "Telangana",
                "delhi": "Delhi", "new delhi": "Delhi", "barrackpore": "West Bengal", "surat": "Gujarat"
            };
            const knownStates = ["Maharashtra", "Karnataka", "Delhi", "Gujarat", "West Bengal", "Tamil Nadu", "Telangana", "Kerala", "Uttar Pradesh", "Rajasthan"];

            const stateTally: Record<string, number> = {};

            validShops.forEach((shop: any) => {
                const addr = (shop.address || "").toLowerCase();
                let foundState = "Unknown/Other";

                for (const state of knownStates) {
                    if (addr.includes(state.toLowerCase())) {
                        foundState = state;
                        break;
                    }
                }

                if (foundState === "Unknown/Other") {
                    for (const [city, state] of Object.entries(cityToState)) {
                        if (addr.includes(city)) {
                            foundState = state;
                            break;
                        }
                    }
                }

                stateTally[foundState] = (stateTally[foundState] || 0) + 1;
            });

            const actualStates = Object.keys(stateTally)
                .map(key => ({ name: key, val: stateTally[key] }))
                .sort((a, b) => b.val - a.val);

            setStateData(actualStates.length > 0 ? actualStates : [{ name: "No Address Data", val: 0 }]);

        } catch (error) {
            console.error("Failed to compile analytics:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrencyLakhs = (val: number) => {
        if (val === 0) return "₹0";
        if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
        return `₹${val.toLocaleString()}`;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p className="font-mono text-sm tracking-widest uppercase">Aggregating Actual DB Metrics...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl animate-in fade-in duration-500 space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Platform Analytics</h1>

                <div className="relative inline-block">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="appearance-none bg-card border border-border px-4 py-2 pr-10 rounded-lg text-sm text-foreground hover:border-primary/50 transition-colors focus:outline-none focus:border-primary cursor-pointer shadow-sm"
                    >
                        <option className="bg-card" value="All Time">All Time</option>
                        <option className="bg-card" value="This Year">This year</option>
                        <option className="bg-card" value="This Month">This month</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
            </div>

            {/* KPI Cards (Row 1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm transition-colors">
                    <p className="text-[11px] text-muted-foreground mb-2 font-bold uppercase tracking-wider">Total Shops</p>
                    <p className="text-2xl font-bold text-foreground">{kpis.totalShops}</p>
                </div>
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm transition-colors">
                    <p className="text-[11px] text-emerald-500/80 mb-2 font-bold uppercase tracking-wider">Active</p>
                    <p className="text-2xl font-bold text-emerald-500">{kpis.activeShops}</p>
                </div>
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm transition-colors">
                    <p className="text-[11px] text-warning/80 mb-2 font-bold uppercase tracking-wider">Pending</p>
                    <p className="text-2xl font-bold text-warning">{kpis.pendingShops}</p>
                </div>
                <div className="bg-card border border-primary/30 p-5 rounded-xl shadow-sm transition-colors">
                    <p className="text-[11px] text-primary/80 mb-2 font-bold uppercase tracking-wider">Platform GMV</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrencyLakhs(kpis.totalGmv)}</p>
                </div>

                <div className="bg-card border border-border p-5 rounded-xl shadow-sm relative overflow-hidden z-0 transition-colors">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-muted rounded-bl-full -mr-4 -mt-4"></div>
                    <p className="text-[11px] text-muted-foreground mb-1 font-bold uppercase tracking-wider relative z-10">Expiry Loss Prevented</p>
                    <p className="text-2xl font-bold text-foreground relative z-10">{formatCurrencyLakhs(kpis.expiryLossPrevented)}</p>
                    <p className="text-[9px] text-muted-foreground/50 mt-1 relative z-10 tracking-widest">*Industry Est.</p>
                </div>
            </div>

            {/* Growth & Leaderboard (Row 2 - Split Column) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Shop Growth Area Chart */}
                <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm h-[340px] flex flex-col transition-colors">
                    <h2 className="font-semibold text-foreground mb-6">Shop growth (registrations)</h2>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={registrationData} margin={{ left: -20, bottom: 0, right: 10 }}>
                                <defs>
                                    <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", color: "var(--foreground)" }}
                                    itemStyle={{ color: "#10b981", fontWeight: "bold" }}
                                />
                                <Area type="monotone" dataKey="registrations" stroke="#10b981" strokeWidth={3} fill="url(#colorReg)" dot={{ r: 4, fill: "var(--card)", stroke: "#10b981", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Most Active Shops */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm h-[340px] overflow-hidden transition-colors">
                    <h2 className="font-semibold text-foreground mb-6">Top Revenue Shops</h2>
                    <div className="space-y-6 mt-2 overflow-y-auto max-h-[240px] custom-scrollbar pr-2">
                        {topShops.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No sales data recorded yet.</p>
                        ) : (
                            topShops.map((s, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-xs mb-2">
                                        <span className="text-foreground font-medium">{s.name}</span>
                                        <span className="font-mono text-emerald-500">₹{s.val.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-secondary h-3.5 rounded-sm overflow-hidden border border-border">
                                        <div className="bg-emerald-500 h-full rounded-sm" style={{ width: `${Math.max(s.percentage, 2)}%` }} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Aggregate Sales (Row 3 - FULL WIDTH) */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm h-[340px] flex flex-col transition-colors">
                <h2 className="font-semibold text-foreground mb-6">Aggregate platform sales (₹)</h2>
                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={salesData} margin={{ left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                            <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={80} tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : value} />
                            <Tooltip
                                cursor={{ fill: 'var(--foreground)', opacity: 0.05 }}
                                contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", color: "var(--foreground)" }}
                                itemStyle={{ color: "#10b981", fontWeight: "bold" }}
                            />
                            <Bar dataKey="sales" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={60} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* True Geographic Distribution (Row 4 - FULL WIDTH) */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm transition-colors">
                <h2 className="font-semibold text-foreground mb-8">Shops by location (Parsed)</h2>
                <div className="space-y-6 w-full pr-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {stateData.map((s, i) => (
                        <div key={i} className="flex items-center gap-6">
                            <div className="w-32 text-sm text-foreground truncate">{s.name}</div>
                            <div className="flex-1 bg-secondary h-5 rounded-sm border border-border">
                                <div className="bg-emerald-500 h-full rounded-sm transition-all duration-1000" style={{ width: `${(s.val / Math.max(stateData[0]?.val, 1)) * 100}%` }} />
                            </div>
                            <div className="w-16 text-right text-xs text-muted-foreground font-mono">{s.val} shops</div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}