"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Area, AreaChart, BarChart, Bar
} from "recharts";
import { supabase } from "../../lib/supabase";

// Custom UI Component to replace the ugly native HTML <select> dropdowns
const FilterDropdown = ({ value, options, onChange }: { value: string, options: { value: string, label: string }[], onChange: (val: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedLabel = options.find((o) => o.value === value)?.label || value;

    return (
        <div className="relative w-full sm:w-auto shrink-0" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-card border border-border rounded-lg flex items-center justify-between px-3 py-2 sm:py-2.5 shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20 sm:min-w-[140px]"
            >
                <span className="text-foreground text-xs sm:text-sm font-bold truncate pr-4">{selectedLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 sm:left-auto mt-1.5 w-full sm:min-w-[140px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="py-1 max-h-[250px] overflow-y-auto custom-scrollbar">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-xs sm:text-sm transition-colors hover:bg-muted ${value === opt.value ? 'bg-primary/10 text-primary font-bold' : 'text-foreground font-medium'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function AnalyticsPage() {
    const router = useRouter();
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

            // --- STRICT VAULT CHECK ---
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");

            const { data: platformAdmin } = await supabase
                .from('platform_admins')
                .select('is_active')
                .eq('id', user.id)
                .maybeSingle();

            if (!platformAdmin || !platformAdmin.is_active) {
                console.warn("Unauthorized data access attempt.");
                return router.push("/login");
            }

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
                <p className="font-mono text-sm tracking-widest uppercase font-bold text-center">Aggregating Actual DB Metrics...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500 space-y-6 sm:space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Platform Analytics</h1>

                {/* Custom Filter Dropdown */}
                <FilterDropdown
                    value={timeRange}
                    onChange={setTimeRange}
                    options={[
                        { value: "All Time", label: "All Time" },
                        { value: "This Year", label: "This year" },
                        { value: "This Month", label: "This month" },
                    ]}
                />
            </div>

            {/* KPI Cards (Row 1) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="bg-card border border-border p-4 sm:p-5 rounded-xl shadow-sm transition-colors">
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground mb-1 sm:mb-2 font-bold uppercase tracking-wider">Total Shops</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{kpis.totalShops}</p>
                </div>
                <div className="bg-card border border-border p-4 sm:p-5 rounded-xl shadow-sm transition-colors">
                    <p className="text-[10px] sm:text-[11px] text-emerald-500/80 mb-1 sm:mb-2 font-bold uppercase tracking-wider">Active</p>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-500">{kpis.activeShops}</p>
                </div>
                <div className="bg-card border border-border p-4 sm:p-5 rounded-xl shadow-sm transition-colors">
                    <p className="text-[10px] sm:text-[11px] text-warning/80 mb-1 sm:mb-2 font-bold uppercase tracking-wider">Pending</p>
                    <p className="text-xl sm:text-2xl font-bold text-warning">{kpis.pendingShops}</p>
                </div>
                <div className="bg-card border border-primary/30 p-4 sm:p-5 rounded-xl shadow-sm transition-colors">
                    <p className="text-[10px] sm:text-[11px] text-primary/80 mb-1 sm:mb-2 font-bold uppercase tracking-wider">Platform GMV</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{formatCurrencyLakhs(kpis.totalGmv)}</p>
                </div>

                {/* Expiry metric spans 2 columns on mobile so it stays visible */}
                <div className="col-span-2 lg:col-span-1 bg-card border border-border p-4 sm:p-5 rounded-xl shadow-sm relative overflow-hidden z-0 transition-colors">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-muted rounded-bl-full -mr-4 -mt-4"></div>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground mb-1 sm:mb-1 font-bold uppercase tracking-wider relative z-10">Expiry Loss Prevented</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground relative z-10">{formatCurrencyLakhs(kpis.expiryLossPrevented)}</p>
                    <p className="text-[8px] sm:text-[9px] text-muted-foreground/50 mt-1 relative z-10 tracking-widest">*Industry Est.</p>
                </div>
            </div>

            {/* Growth & Leaderboard (Row 2 - Split Column) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Shop Growth Area Chart */}
                <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm h-72 sm:h-[340px] flex flex-col transition-colors">
                    <h2 className="font-semibold text-foreground text-sm sm:text-base mb-4 sm:mb-6">Shop growth (registrations)</h2>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={registrationData} margin={{ left: -20, bottom: 0, right: 10, top: 10 }}>
                                <defs>
                                    <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "12px" }}
                                    itemStyle={{ color: "#10b981", fontWeight: "bold" }}
                                />
                                <Area type="monotone" dataKey="registrations" stroke="#10b981" strokeWidth={2.5} fill="url(#colorReg)" dot={{ r: 3, fill: "var(--card)", stroke: "#10b981", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Most Active Shops */}
                <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm h-72 sm:h-[340px] overflow-hidden transition-colors flex flex-col">
                    <h2 className="font-semibold text-foreground text-sm sm:text-base mb-4 sm:mb-6 shrink-0">Top Revenue Shops</h2>
                    <div className="space-y-4 sm:space-y-6 mt-1 overflow-y-auto flex-1 custom-scrollbar pr-2">
                        {topShops.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center pt-10">No sales data recorded yet.</p>
                        ) : (
                            topShops.map((s, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-[11px] sm:text-xs mb-1.5 sm:mb-2">
                                        <span className="text-foreground font-medium truncate pr-2">{s.name}</span>
                                        <span className="font-mono text-emerald-500 shrink-0">₹{s.val.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-secondary h-2.5 sm:h-3.5 rounded-sm overflow-hidden border border-border">
                                        <div className="bg-emerald-500 h-full rounded-sm" style={{ width: `${Math.max(s.percentage, 2)}%` }} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Aggregate Sales (Row 3 - FULL WIDTH) */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm h-72 sm:h-[340px] flex flex-col transition-colors">
                <h2 className="font-semibold text-foreground text-sm sm:text-base mb-4 sm:mb-6">Aggregate platform sales (₹)</h2>
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={salesData} margin={{ left: -15, bottom: 0, top: 10, right: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                            <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={50} tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : value} />
                            <Tooltip
                                cursor={{ fill: 'var(--foreground)', opacity: 0.05 }}
                                contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", color: "var(--foreground)", fontSize: "12px" }}
                                itemStyle={{ color: "#10b981", fontWeight: "bold" }}
                            />
                            <Bar dataKey="sales" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* True Geographic Distribution (Row 4 - FULL WIDTH) */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm transition-colors">
                <h2 className="font-semibold text-foreground text-sm sm:text-base mb-6 sm:mb-8">Shops by location (Parsed)</h2>
                <div className="space-y-5 sm:space-y-6 w-full pr-2 sm:pr-4 max-h-[250px] sm:max-h-[300px] overflow-y-auto custom-scrollbar">
                    {stateData.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 sm:gap-6">
                            <div className="w-24 sm:w-32 text-xs sm:text-sm text-foreground truncate shrink-0">{s.name}</div>
                            <div className="flex-1 bg-secondary h-4 sm:h-5 rounded-sm border border-border">
                                <div className="bg-emerald-500 h-full rounded-sm transition-all duration-1000" style={{ width: `${(s.val / Math.max(stateData[0]?.val, 1)) * 100}%` }} />
                            </div>
                            <div className="w-14 sm:w-16 text-right text-[10px] sm:text-xs text-muted-foreground font-mono shrink-0">{s.val} shops</div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}