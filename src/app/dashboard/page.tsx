"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import {
    TrendingUp, Wallet, AlertTriangle, AlertCircle,
    Receipt, Plus, Loader2, Download, Skull, Lock
} from "lucide-react";

interface DashboardMetrics {
    todaySales: number;
    stockValue: number;
    nearExpiryCount: number;
    expiredCount: number;
    lowStockCount: number;
}

interface NearExpiryItem {
    id: string;
    medicine_name: string;
    expiry_date: string;
    batch_number: string;
    quantity: number;
    is_expired: boolean;
}

interface DailySales {
    dateString: string;
    day: string;
    amount: number;
    isToday: boolean;
}

export default function DashboardHome() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [shopId, setShopId] = useState<string | null>(null);

    const [shopPlan, setShopPlan] = useState<string>("STARTER");

    const [metrics, setMetrics] = useState<DashboardMetrics>({
        todaySales: 0, stockValue: 0, nearExpiryCount: 0, expiredCount: 0, lowStockCount: 0
    });
    const [expiringItems, setExpiringItems] = useState<NearExpiryItem[]>([]);
    const [weeklySales, setWeeklySales] = useState<DailySales[]>([]);

    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    const loadDashboardData = useCallback(async (currentShopId: string, isBackgroundSync = false) => {
        try {
            if (!isBackgroundSync) setIsLoading(true);
            else setIsSyncing(true);

            const { data: shopData } = await supabase.from('shops').select('plan').eq('id', currentShopId).single();
            if (shopData && shopData.plan) {
                setShopPlan(shopData.plan);
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const ninetyDaysFromNow = new Date(today);
            ninetyDaysFromNow.setDate(today.getDate() + 90);

            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 6);

            let allInventory: any[] = [];
            let hasMore = true;
            let page = 0;
            const pageSize = 1000;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('inventory')
                    .select('id, medicine_name, quantity, purchase_price, expiry_date, batch_number')
                    .eq('shop_id', currentShopId)
                    .gt('quantity', 0)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    allInventory = [...allInventory, ...data];
                    page++;
                } else {
                    hasMore = false;
                }
            }

            let stockVal = 0;
            let nearExpCount = 0;
            let alreadyExpiredCount = 0;
            let lowStkCount = 0;
            const expiringList: NearExpiryItem[] = [];

            if (allInventory.length > 0) {
                allInventory.forEach(item => {
                    stockVal += (item.quantity * (Number(item.purchase_price) || 0));

                    if (item.quantity < 15) lowStkCount++;

                    const expDate = new Date(item.expiry_date);

                    if (expDate < today) {
                        alreadyExpiredCount++;
                        expiringList.push({ ...item, is_expired: true });
                    } else if (expDate <= ninetyDaysFromNow) {
                        nearExpCount++;
                        expiringList.push({ ...item, is_expired: false });
                    }
                });
            }

            expiringList.sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

            const { data: recentBills } = await supabase
                .from('bills')
                .select('total_amount, created_at')
                .eq('shop_id', currentShopId)
                .gte('created_at', sevenDaysAgo.toISOString());

            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const weekData: DailySales[] = [];

            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                weekData.push({
                    dateString,
                    day: days[d.getDay()],
                    amount: 0,
                    isToday: i === 0
                });
            }

            let todayTotal = 0;

            if (recentBills) {
                recentBills.forEach(bill => {
                    const billDateObj = new Date(bill.created_at);
                    const billDateString = `${billDateObj.getFullYear()}-${String(billDateObj.getMonth() + 1).padStart(2, '0')}-${String(billDateObj.getDate()).padStart(2, '0')}`;

                    const targetDay = weekData.find(d => d.dateString === billDateString);
                    const amount = Number(bill.total_amount) || 0;

                    if (targetDay) {
                        targetDay.amount += amount;
                    }
                    if (billDateString === weekData[6].dateString) {
                        todayTotal += amount;
                    }
                });
            }

            setMetrics({
                todaySales: todayTotal,
                stockValue: stockVal,
                nearExpiryCount: nearExpCount,
                expiredCount: alreadyExpiredCount,
                lowStockCount: lowStkCount
            });

            setExpiringItems(expiringList.slice(0, 5));
            setWeeklySales(weekData);

        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            setIsLoading(false);
            setIsSyncing(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        let realtimeChannel: any;

        const initDashboard = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: userData } = await supabase.from('users').select('shop_id').eq('id', user.id).single();
            if (!userData?.shop_id) return;

            const currentShopId = userData.shop_id;
            setShopId(currentShopId);

            await loadDashboardData(currentShopId, false);

            const uniqueChannelName = `dashboard-sync-${currentShopId}-${Date.now()}`;

            const handleDatabaseChange = () => {
                if (!isMounted) return;
                if (debounceTimer.current) clearTimeout(debounceTimer.current);
                setIsSyncing(true);
                debounceTimer.current = setTimeout(() => {
                    loadDashboardData(currentShopId, true);
                }, 2000);
            };

            realtimeChannel = supabase.channel(uniqueChannelName)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `shop_id=eq.${currentShopId}` }, handleDatabaseChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `shop_id=eq.${currentShopId}` }, handleDatabaseChange)
                .subscribe();
        };

        initDashboard();

        return () => {
            isMounted = false;
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        };
    }, [loadDashboardData]);


    const formatCurrency = (value: number) => {
        if (value >= 100000) return `₹ ${(value / 100000).toFixed(2)} L`;
        return `₹ ${value.toLocaleString('en-IN')}`;
    };

    const formatDate = (dateString: string) => {
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-GB', options);
    };

    const handleExportCSV = () => {
        if (shopPlan === "STARTER") {
            alert("Advanced CSV Reporting is only available on Growth and Pro plans. Please upgrade to unlock this feature.");
            router.push('/dashboard/settings');
            return;
        }

        const headers = ["Date", "Day", "Total Sales (INR)"];
        const csvRows = weeklySales.map(day => `${day.dateString},${day.day},${day.amount}`);
        const csvContent = [headers.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Weekly_Sales_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p className="font-mono text-sm tracking-widest uppercase">Compiling secure analytics...</p>
            </div>
        );
    }

    const maxSales = Math.max(...weeklySales.map(d => d.amount), 1);
    const midSales = maxSales / 2;

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500 space-y-8 pb-10">

            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1 flex items-center gap-3">
                        Dashboard
                        {isSyncing && (
                            <span className="flex items-center gap-1.5 text-[10px] text-primary font-mono uppercase bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping"></span> Live Syncing
                            </span>
                        )}
                    </h1>
                    <p className="text-muted-foreground text-sm">Overview of your clinical inventory</p>
                </div>

                <button onClick={handleExportCSV} className="hidden sm:flex items-center gap-2 bg-primary/10 border border-primary/30 hover:bg-primary hover:text-primary-foreground text-primary px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5">
                    <Download className="w-4 h-4" /> Export Report
                </button>
            </div>

            {/* Top Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">

                <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden group col-span-2 lg:col-span-1 shadow-sm transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Today's Sales</h3>
                        <TrendingUp className="w-4 h-4 text-primary opacity-70" />
                    </div>
                    <div className="text-2xl font-bold text-foreground tracking-tight">{formatCurrency(metrics.todaySales)}</div>
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 relative overflow-hidden group shadow-sm transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Stock Value</h3>
                        <Wallet className="w-4 h-4 text-muted-foreground opacity-70" />
                    </div>
                    <div className="text-2xl font-bold text-foreground tracking-tight">{formatCurrency(metrics.stockValue)}</div>
                </div>

                {/* --- AMBER: Near Expiry --- */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 relative overflow-hidden group shadow-sm transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-mono text-amber-500 uppercase tracking-widest">Near Expiry</h3>
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-amber-500 tracking-tight">{metrics.nearExpiryCount}</div>
                </div>

                {/* --- RED: Expired --- */}
                <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-5 relative overflow-hidden group shadow-sm transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-mono text-destructive uppercase tracking-widest">Expired</h3>
                        <Skull className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="text-2xl font-bold text-destructive tracking-tight">{metrics.expiredCount}</div>
                </div>

                {/* --- ORANGE: Low Stock --- */}
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 relative overflow-hidden group shadow-sm transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-mono text-orange-500 uppercase tracking-widest">Low Stock</h3>
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="text-2xl font-bold text-orange-500 tracking-tight">{metrics.lowStockCount}</div>
                </div>

            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.push('/dashboard/sell')}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-sm"
                >
                    <Receipt className="w-4 h-4" /> New Bill
                </button>
                <button
                    onClick={() => router.push('/dashboard/stock-entry')}
                    className="flex items-center gap-2 bg-transparent border border-primary text-primary px-6 py-2.5 rounded-xl font-bold hover:bg-primary/10 transition-all"
                >
                    <Plus className="w-4 h-4" /> Add Stock
                </button>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Expiry Action Table */}
                <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col transition-colors">
                    <div className="p-6 flex justify-between items-center border-b border-border bg-muted/30">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            Critical Inventory Alerts
                        </h2>
                        <button
                            onClick={() => router.push('/dashboard/inventory?filter=expiring')}
                            className="text-xs font-bold text-primary hover:text-foreground transition-colors uppercase tracking-wider"
                        >
                            View All
                        </button>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead>
                                <tr className="text-[10px] tracking-wider text-muted-foreground font-mono border-b border-border uppercase">
                                    <th className="px-6 py-4">Medicine</th>
                                    <th className="px-6 py-4">Status / Exp Date</th>
                                    <th className="px-6 py-4">Batch</th>
                                    <th className="px-6 py-4 text-right">Qty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {expiringItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm italic">
                                            No critical expiry alerts. Shelves are clear.
                                        </td>
                                    </tr>
                                ) : (
                                    expiringItems.map((item) => (
                                        <tr key={item.id} className={`transition-colors ${item.is_expired ? 'bg-destructive/5 hover:bg-destructive/10' : 'hover:bg-muted/50'}`}>
                                            <td className="px-6 py-4 text-sm text-foreground font-medium flex items-center gap-2">
                                                {item.is_expired && <Skull className="w-4 h-4 text-destructive shrink-0" />}
                                                {item.medicine_name}
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.is_expired ? (
                                                    <span className="bg-destructive/20 text-destructive border border-destructive/30 px-2 py-0.5 rounded text-xs font-bold">
                                                        EXPIRED
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-amber-500 font-bold">
                                                        {formatDate(item.expiry_date)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-background border border-border px-2.5 py-1 rounded text-[11px] font-mono text-muted-foreground">
                                                    {item.batch_number}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-sm font-bold text-right ${item.is_expired ? 'text-destructive' : 'text-foreground'}`}>
                                                {item.quantity}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* VISUAL SALES CHART */}
                <div className="bg-card border border-border rounded-2xl shadow-sm p-6 flex flex-col relative overflow-hidden transition-colors">

                    {/* FEATURE GATE: Analytics Blur for Starter Plan */}
                    {shopPlan === "STARTER" && (
                        <div className="absolute inset-0 z-20 backdrop-blur-md bg-background/80 flex flex-col items-center justify-center border border-primary/20 p-6 text-center animate-in fade-in">
                            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4 border border-primary/30">
                                <Lock className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-foreground font-bold text-lg mb-2">Analytics Locked</h3>
                            <p className="text-muted-foreground text-xs mb-5 max-w-[200px] leading-relaxed">
                                Upgrade to the Growth plan to unlock 7-day visual sales trends and predictive insights.
                            </p>
                            <button
                                onClick={() => router.push('/dashboard/settings')}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all cursor-pointer"
                            >
                                View Plans
                            </button>
                        </div>
                    )}

                    <div className="flex justify-between items-center mb-8 relative z-10">
                        <h2 className="text-lg font-bold text-foreground">Sales (7 days)</h2>
                    </div>

                    <div className="flex-1 relative mt-auto pb-6 z-10">
                        {/* Graph Background Grid & Y-Axis Labels */}
                        <div className="absolute inset-0 flex flex-col justify-between pb-6 pointer-events-none">
                            <div className="border-b border-border w-full h-0 flex items-center">
                                <span className="absolute -left-1 text-[10px] font-mono text-muted-foreground -translate-y-full pb-1">₹{(maxSales >= 1000 ? (maxSales / 1000).toFixed(1) + 'k' : maxSales)}</span>
                            </div>
                            <div className="border-b border-border w-full h-0 flex items-center">
                                <span className="absolute -left-1 text-[10px] font-mono text-muted-foreground -translate-y-full pb-1">₹{(midSales >= 1000 ? (midSales / 1000).toFixed(1) + 'k' : midSales.toFixed(0))}</span>
                            </div>
                            <div className="border-b border-border w-full h-0"></div>
                        </div>

                        {/* Chart Bars */}
                        <div className="flex items-end justify-between gap-3 h-48 relative">
                            {weeklySales.map((data, index) => {
                                const heightPct = data.amount > 0 ? Math.max((data.amount / maxSales) * 100, 5) : 2;

                                return (
                                    <div key={index} className="flex flex-col items-center justify-end h-full w-full group relative">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-popover border border-border text-popover-foreground text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-20 flex flex-col items-center">
                                            ₹{data.amount.toLocaleString('en-IN')}
                                            <div className="absolute top-full w-2 h-2 bg-popover border-b border-r border-border rotate-45 -translate-y-1.5"></div>
                                        </div>
                                        <div
                                            className={`w-full max-w-[28px] rounded-t-sm transition-all duration-700 ease-out ${data.isToday && data.amount > 0
                                                ? 'bg-primary shadow-sm'
                                                : data.amount > 0
                                                    ? 'bg-primary/40 hover:bg-primary/70'
                                                    : 'bg-muted'
                                                }`}
                                            style={{ height: `${heightPct}%` }}
                                        ></div>
                                        <span className={`absolute -bottom-6 text-[10px] font-mono ${data.isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                                            {data.day}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}