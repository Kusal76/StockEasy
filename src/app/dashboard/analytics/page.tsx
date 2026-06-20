"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { LineChart, BarChart, PieChart, Pie, Cell, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";
import { Banknote, Receipt, AlertTriangle, Ban, Loader2, ChevronDown, Clock, PieChart as PieChartIcon, TrendingUp, Lock } from "lucide-react";

export default function AnalyticsDashboard() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<"7d" | "30d" | "1y">("30d");

    // --- FEATURE GATING STATES ---
    const [isAuthorizing, setIsAuthorizing] = useState(true);
    const [shopPlan, setShopPlan] = useState<string>("STARTER");

    // Processed Data States
    const [salesData, setSalesData] = useState<any[]>([]);
    const [expiryTrendData, setExpiryTrendData] = useState<any[]>([]);
    const [topSellers, setTopSellers] = useState<any[]>([]);
    const [paymentData, setPaymentData] = useState<any[]>([]);
    const [peakHoursData, setPeakHoursData] = useState<any[]>([]);

    // Smart Insight Text
    const [smartInsight, setSmartInsight] = useState("");

    // KPI States
    const [kpis, setKpis] = useState({
        sales: 0,
        profit: 0,
        bills: 0,
        nearExpiry: 0,
        deadStock: 0,
        expiryLoss: 0
    });

    const PIE_COLORS = ['#6ee591', '#3b82f6', '#f59e0b', '#ef4444'];

    useEffect(() => {
        checkAuthAndLoad();
    }, [timeRange]);

    // 1. ADD THESE STATES AT THE TOP OF AnalyticsDashboard
    const [isStaff, setIsStaff] = useState(false);
    const [userEmail, setUserEmail] = useState("");

    // 2. REPLACE checkAuthAndLoad WITH THIS
    const checkAuthAndLoad = async () => {
        if (salesData.length === 0) setIsAuthorizing(true);
        setIsLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setUserEmail(user.email || "");

            // 1. HARD BLOCK: Check if they are in the staff table
            const { data: staffProfile } = await supabase.from('staff_profiles').select('id').eq('id', user.id).maybeSingle();
            if (staffProfile) {
                setIsStaff(true);
                return; // Stop loading and show Restricted UI
            }

            // Fetch role to enforce security (fallback check)
            const { data: userData } = await supabase.from('users').select('shop_id, role').eq('id', user.id).single();
            if (!userData?.shop_id) return;

            if (userData.role?.toUpperCase() === "STAFF") {
                setIsStaff(true);
                return; // Stop loading and show Restricted UI
            }

            // Fetch the current plan securely
            const { data: shopData } = await supabase.from('shops').select('plan').eq('id', userData.shop_id).single();
            const currentPlan = shopData?.plan?.toUpperCase() || "STARTER";
            setShopPlan(currentPlan);

            // ONLY load the heavy analytics math if they are a paying PRO user
            if (currentPlan === "PRO") {
                await fetchAndProcessData(userData.shop_id);
            }
        } catch (error) {
            console.error("Authorization check failed:", error);
        } finally {
            setIsAuthorizing(false);
            setIsLoading(false);
        }
    };

    // 3. ADD THIS RENDER BLOCK RIGHT AFTER `if (isAuthorizing) { return (...) }`
    // --- RESTRICTED ACCESS SCREEN FOR STAFF ---
    if (isStaff) {
        return (
            <div className="max-w-2xl mx-auto mt-20 animate-in fade-in duration-500 transition-colors duration-300">
                <div className="bg-card border border-destructive/30 rounded-2xl shadow-xl p-10 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-destructive to-transparent opacity-50"></div>
                    <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6 border border-destructive/20 shadow-sm">
                        <Ban className="w-10 h-10 text-destructive" />
                    </div>
                    <h1 className="text-3xl font-bold text-foreground mb-3">Access Restricted</h1>
                    <p className="text-muted-foreground mb-6 max-w-md leading-relaxed font-medium">
                        Your account is provisioned with <strong>Staff</strong> privileges. Enterprise analytics, financial insights, and predictive forecasting are strictly restricted to the Shop Owner.
                    </p>
                    <div className="px-6 py-3 bg-secondary border border-border rounded-xl text-sm font-mono text-muted-foreground shadow-sm">
                        Logged in as: <span className="text-foreground font-bold">{userEmail}</span>
                    </div>
                </div>
            </div>
        );
    }

    const fetchAndProcessData = async (shopId: string) => {
        try {
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const pastDate = new Date(now);
            if (timeRange === "7d") pastDate.setDate(now.getDate() - 7);
            if (timeRange === "30d") pastDate.setDate(now.getDate() - 30);
            if (timeRange === "1y") pastDate.setFullYear(now.getFullYear() - 1);

            const { data: bills, error: billsError } = await supabase
                .from('bills')
                .select(`*, bill_items (medicine_name, quantity, unit_price, total_price)`)
                .eq('shop_id', shopId)
                .gte('created_at', pastDate.toISOString())
                .order('created_at', { ascending: true });

            if (billsError) throw billsError;

            const { data: inventory, error: invError } = await supabase
                .from('inventory')
                .select('medicine_name, quantity, mrp, purchase_price, expiry_date')
                .eq('shop_id', shopId)
                .gt('quantity', 0);

            if (invError) throw invError;

            processData(bills || [], inventory || [], now);

        } catch (error) {
            console.error("Analytics Error:", error);
        }
    };

    const processData = (bills: any[], inventory: any[], now: Date) => {
        let totalSales = 0;
        let totalProfit = 0;
        const salesMap: Record<string, number> = {};
        const medicineMap: Record<string, number> = {};
        const paymentMap: Record<string, number> = { "Cash": 0, "UPI": 0, "Card": 0 };
        const hoursMap = { "Morning (8-12)": 0, "Afternoon (12-16)": 0, "Evening (16-20)": 0, "Night (20+)": 0 };

        const avgCostMap: Record<string, number> = {};
        inventory.forEach(inv => {
            if (!avgCostMap[inv.medicine_name]) {
                avgCostMap[inv.medicine_name] = inv.purchase_price || (inv.mrp * 0.7);
            }
        });

        bills.forEach(bill => {
            totalSales += bill.total_amount;

            const bDate = new Date(bill.created_at);
            const dateKey = timeRange === '1y'
                ? bDate.toLocaleDateString('en-IN', { month: 'short' })
                : bDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            salesMap[dateKey] = (salesMap[dateKey] || 0) + bill.total_amount;

            const method = bill.payment_method.includes("UPI") ? "UPI" : bill.payment_method;
            paymentMap[method] = (paymentMap[method] || 0) + bill.total_amount;

            const hour = bDate.getHours();
            if (hour >= 8 && hour < 12) hoursMap["Morning (8-12)"]++;
            else if (hour >= 12 && hour < 16) hoursMap["Afternoon (12-16)"]++;
            else if (hour >= 16 && hour < 20) hoursMap["Evening (16-20)"]++;
            else hoursMap["Night (20+)"]++;

            bill.bill_items.forEach((item: any) => {
                medicineMap[item.medicine_name] = (medicineMap[item.medicine_name] || 0) + item.quantity;
                const estimatedCost = (avgCostMap[item.medicine_name] || (item.unit_price * 0.7)) * item.quantity;
                totalProfit += (item.total_price - estimatedCost);
            });
        });

        const formattedSales = Object.keys(salesMap).map(date => ({ date, sales: salesMap[date] }));

        const formattedPayments = Object.keys(paymentMap)
            .filter(k => paymentMap[k] > 0)
            .map(name => ({ name, value: paymentMap[name] }));

        const formattedPeakHours = Object.keys(hoursMap).map(time => ({ time, orders: hoursMap[time as keyof typeof hoursMap] }));

        const topMeds = Object.entries(medicineMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const maxMedSales = topMeds.length > 0 ? topMeds[0][1] : 1;
        const formattedTopSellers = topMeds.map(([name, qty]) => ({
            name, qty, percentage: Math.round((qty / maxMedSales) * 100)
        }));

        let nearExpiryCount = 0;
        let deadStockCount = 0;
        let expiryLossRisk = 0;
        const expiryTrendMap: Record<string, number> = {};

        const thirtyDaysFromNow = new Date(now);
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        inventory.forEach(item => {
            const expString = item.expiry_date.includes('T') ? item.expiry_date : `${item.expiry_date}T00:00:00`;
            const expDate = new Date(expString);
            const valueLoss = item.quantity * item.purchase_price;

            if (expDate < now) {
                deadStockCount++;
            } else if (expDate <= thirtyDaysFromNow) {
                nearExpiryCount++;
                expiryLossRisk += valueLoss;
            }

            if (expDate >= now) {
                const monthYear = expDate.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
                expiryTrendMap[monthYear] = (expiryTrendMap[monthYear] || 0) + valueLoss;
            }
        });

        const formattedExpiryTrend = Object.keys(expiryTrendMap)
            .map(date => ({ date, lossValue: expiryTrendMap[date], rawDate: new Date(`01 ${date}`) }))
            .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime()).slice(0, 8);

        let insight = "";
        if (formattedPayments.length > 0 && bills.length > 0) {
            let busiestTime = Object.keys(hoursMap).reduce((a, b) => hoursMap[a as keyof typeof hoursMap] > hoursMap[b as keyof typeof hoursMap] ? a : b);
            let topPayment = formattedPayments.sort((a, b) => b.value - a.value)[0].name;
            insight = `Your busiest time is the ${busiestTime.split(' ')[0]}, mostly processing ${topPayment} payments. `;
        } else {
            insight = "Generate a few bills to unlock traffic insights. ";
        }

        if (nearExpiryCount > 0) {
            insight += `Action required: You have ₹${expiryLossRisk.toLocaleString('en-IN')} in stock expiring within 30 days.`;
        } else {
            insight += `Your inventory health is perfect with no immediate expiry risks!`;
        }

        setSalesData(formattedSales);
        setTopSellers(formattedTopSellers);
        setPaymentData(formattedPayments);
        setPeakHoursData(formattedPeakHours);
        setExpiryTrendData(formattedExpiryTrend);
        setSmartInsight(insight);
        setKpis({
            sales: totalSales,
            profit: totalProfit,
            bills: bills.length,
            nearExpiry: nearExpiryCount,
            deadStock: deadStockCount,
            expiryLoss: expiryLossRisk
        });
    };

    // --- Loading State ---
    if (isAuthorizing) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-muted-foreground transition-colors duration-300">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p className="font-mono text-sm tracking-widest uppercase font-bold">Verifying Authorization...</p>
            </div>
        );
    }

    // --- GATED ACCESS SCREEN ---
    if (shopPlan !== "PRO") {
        return (
            <div className="max-w-2xl mx-auto mt-20 animate-in fade-in duration-500 transition-colors duration-300">
                <div className="bg-card border border-primary/30 rounded-2xl shadow-xl p-10 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20 shadow-sm">
                        <Lock className="w-10 h-10 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold text-foreground mb-3">Enterprise Analytics Locked</h1>
                    <p className="text-muted-foreground mb-8 leading-relaxed max-w-md font-medium">
                        Deep financial insights, predictive expiry forecasting, and peak traffic tracking are strictly reserved for enterprise pharmacies. Please upgrade to the <strong>Pro Plan</strong> to unlock this module.
                    </p>
                    <button
                        onClick={() => router.push('/dashboard/settings')}
                        className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
                    >
                        Upgrade to Pro
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500 space-y-6 pb-10 transition-colors duration-300">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">Analytics Dashboard</h1>
                </div>

                <div className="relative bg-card border border-border rounded-xl flex items-center px-4 py-2.5 shadow-sm transition-colors">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as any)}
                        className="bg-transparent text-foreground text-sm font-bold focus:outline-none cursor-pointer appearance-none pr-6"
                    >
                        <option className="bg-card" value="7d">Last 7 days</option>
                        <option className="bg-card" value="30d">Last 30 days</option>
                        <option className="bg-card" value="1y">This Year</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 pointer-events-none" />
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                    <p className="font-bold">Aggregating analytics...</p>
                </div>
            ) : (
                <>
                    <div className="bg-gradient-to-r from-primary/10 to-info/10 border border-primary/20 rounded-xl p-4 flex items-start gap-4 shadow-sm">
                        <div>
                            <h3 className="text-sm font-bold text-foreground mb-1">StockEasy Smart Insight</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed font-medium">{smartInsight}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-4">
                        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm transition-colors">
                            <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-muted-foreground">Total Sales</p><Banknote className="w-4 h-4 text-primary" /></div>
                            <p className="text-xl font-bold text-foreground tracking-tight">₹{kpis.sales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="bg-card border border-primary/30 p-4 rounded-2xl shadow-sm relative overflow-hidden transition-colors">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full"></div>
                            <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-primary">Est. Gross Profit</p><TrendingUp className="w-4 h-4 text-primary" /></div>
                            <p className="text-xl font-bold text-foreground tracking-tight">₹{kpis.profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm transition-colors">
                            <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-muted-foreground">Total Bills</p><Receipt className="w-4 h-4 text-primary" /></div>
                            <p className="text-xl font-bold text-foreground tracking-tight">{kpis.bills}</p>
                        </div>
                        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm transition-colors">
                            <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-muted-foreground">Near Expiry</p><AlertTriangle className="w-4 h-4 text-warning" /></div>
                            <p className="text-xl font-bold text-warning tracking-tight">{kpis.nearExpiry} <span className="text-xs font-medium text-warning/70">items</span></p>
                        </div>
                        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm transition-colors">
                            <div className="flex justify-between items-start mb-2"><p className="text-xs font-bold text-muted-foreground">Dead Stock</p><Ban className="w-4 h-4 text-destructive/80" /></div>
                            <p className="text-xl font-bold text-destructive/90 tracking-tight">{kpis.deadStock} <span className="text-xs font-medium text-destructive/70">items</span></p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col min-h-[320px] transition-colors">
                            <h2 className="font-bold text-foreground text-base mb-6">Sales Volume Over Time</h2>
                            <div className="flex-1 w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={salesData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                                        <Tooltip cursor={{ fill: 'var(--foreground)', opacity: 0.05 }} contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", color: "var(--foreground)" }} />
                                        <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} barSize={35} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col min-h-[320px] transition-colors">
                            <h2 className="font-bold text-foreground text-base mb-2 flex items-center gap-2"><PieChartIcon className="w-4 h-4" /> Revenue by Method</h2>
                            <div className="flex-1 w-full relative">
                                {paymentData.length === 0 ? (
                                    <p className="text-muted-foreground text-sm font-medium absolute inset-0 flex items-center justify-center">No payment data</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={paymentData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                                                {paymentData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", color: "var(--foreground)", fontWeight: "bold" }} formatter={(value) => [`₹${value}`, 'Revenue']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                            <div className="flex justify-center gap-4 mt-2 flex-wrap">
                                {paymentData.map((entry, index) => (
                                    <div key={entry.name} className="flex items-center gap-2 text-sm text-foreground font-bold">
                                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                                        {entry.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col min-h-[280px] transition-colors">
                            <h2 className="font-bold text-foreground text-base mb-6">Top Moving Medicines</h2>
                            <div className="flex-1 flex flex-col justify-around">
                                {topSellers.map((med, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-sm font-bold text-foreground">{med.name}</span>
                                            <span className="text-xs font-bold text-muted-foreground font-mono">{med.qty} Units</span>
                                        </div>
                                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden border border-border/30">
                                            <div className="h-full bg-info rounded-full" style={{ width: `${med.percentage}%` }} />
                                        </div>
                                    </div>
                                ))}
                                {topSellers.length === 0 && <p className="text-muted-foreground text-sm font-medium text-center">No sales data found</p>}
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col min-h-[280px] transition-colors">
                            <h2 className="font-bold text-foreground text-base mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-warning" /> Peak Biller Hours</h2>
                            <div className="flex-1 w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={peakHoursData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", color: "var(--foreground)", fontWeight: "bold" }} formatter={(val) => [val, 'Invoices']} />
                                        <Area type="monotone" dataKey="orders" stroke="#f59e0b" fillOpacity={1} fill="url(#colorOrders)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col min-h-[280px] transition-colors">
                            <h2 className="font-bold text-foreground text-base mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive/80" /> Forecasted Expiry Loss (₹)</h2>
                            <div className="flex-1 w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={expiryTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} vertical={false} />
                                        <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px", color: "var(--foreground)", fontWeight: "bold" }} itemStyle={{ color: "#ef4444" }} formatter={(val) => [`₹${val}`, 'At Risk Value']} />
                                        <Line type="monotone" dataKey="lossValue" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "var(--card)", stroke: "#ef4444", strokeWidth: 2 }} activeDot={{ r: 5, fill: "#ef4444" }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}