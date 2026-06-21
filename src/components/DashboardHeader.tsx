"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../app/lib/supabase";
import { useRouter } from "next/navigation";
import { Search, Bell, LogOut, Settings, User, AlertTriangle, Package, Loader2, X, CheckCheck, RefreshCw } from "lucide-react";

interface SearchResult {
    id: string;
    medicine_name: string;
    generic_name?: string;
    quantity: number;
    mrp: number;
}

interface NotificationItem {
    id: string;
    medicine_name: string;
    batch_number: string;
    quantity: number;
}

export default function DashboardHeader() {
    const router = useRouter();

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [isRefreshing, setIsRefreshing] = useState(false);

    const [userName, setUserName] = useState("Loading...");
    const [userRole, setUserRole] = useState("Owner");
    const [shopName, setShopName] = useState("Pharmacy");
    const [shopLogo, setShopLogo] = useState<string | null>(null);

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    const profileRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) setIsProfileOpen(false);
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearchQuery("");
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        let isMounted = true;

        const initializeHeader = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            let displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || "User";

            const { data: userData } = await supabase.from('users').select('shop_id, role, full_name').eq('id', user.id).single();

            if (userData) {
                const role = userData.role?.toUpperCase() || "STAFF";
                setUserRole(role);

                if (role === 'STAFF') {
                    const { data: staffData } = await supabase.from('staff_profiles').select('name').eq('id', user.id).single();
                    if (staffData?.name) displayName = staffData.name;
                } else {
                    if (userData.full_name) displayName = userData.full_name;
                }

                setUserName(displayName);

                if (userData.shop_id) {
                    const { data: shopData } = await supabase.from('shops').select('name, logo_url').eq('id', userData.shop_id).single();
                    if (shopData) {
                        if (shopData.name) setShopName(shopData.name);
                        if (shopData.logo_url) setShopLogo(shopData.logo_url);
                    }

                    const { data: lowStockData } = await supabase
                        .from('inventory')
                        .select('id, medicine_name, quantity, batch_number')
                        .eq('shop_id', userData.shop_id)
                        .lt('quantity', 15)
                        .gt('quantity', 0)
                        .order('quantity', { ascending: true });

                    if (isMounted && lowStockData) {
                        setNotifications(lowStockData);
                    }
                }
            } else {
                setUserName(displayName);
            }
        };

        initializeHeader();
        return () => { isMounted = false; };
    }, [router]);

    useEffect(() => {
        const fetchSearchResults = async () => {
            const cleanQuery = searchQuery.trim();
            if (cleanQuery.length < 2) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            const { data: { user } } = await supabase.auth.getUser();
            const { data: userData } = await supabase.from('users').select('shop_id').eq('id', user?.id).single();

            if (userData?.shop_id) {
                const { data } = await supabase
                    .from('inventory')
                    .select('id, medicine_name, generic_name, quantity, mrp')
                    .eq('shop_id', userData.shop_id)
                    .or(`medicine_name.ilike.%${cleanQuery}%,generic_name.ilike.%${cleanQuery}%`)
                    .limit(5);

                setSearchResults(data || []);
            }
            setIsSearching(false);
        };

        const delayDebounceFn = setTimeout(() => {
            fetchSearchResults();
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const dismissNotification = (idToDismiss: string) => {
        setNotifications(prev => prev.filter(notif => notif.id !== idToDismiss));
    };

    const clearAllNotifications = () => {
        setNotifications([]);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            window.location.reload();
        }, 500);
    };

    return (
        <header className="flex items-center justify-between py-3 sm:py-3.5 px-4 sm:px-8 bg-card border-b border-border relative z-50 transition-colors duration-300 shadow-sm gap-2 sm:gap-4">

            {/* Left: Global Search */}
            <div className="relative flex-1 w-full max-w-md" ref={searchRef}>
                <div className="relative flex items-center group">
                    <Search className="absolute left-3 sm:left-4 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search brand or composition..."
                        className="w-full bg-secondary hover:bg-muted border border-border text-foreground text-xs sm:text-sm rounded-full pl-9 sm:pl-11 pr-4 py-2 sm:py-2.5 focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/60 shadow-sm"
                    />
                    {isSearching && <Loader2 className="absolute right-3 sm:right-4 w-4 h-4 text-primary animate-spin" />}
                </div>

                {searchQuery.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 z-50">
                        {searchResults.length > 0 ? (
                            <ul className="divide-y divide-border/50 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {searchResults.map((item) => (
                                    <li key={item.id} className="p-3 hover:bg-muted/50 cursor-pointer flex justify-between items-center transition-colors" onClick={() => { setSearchQuery(""); router.push('/dashboard/inventory'); }}>
                                        <div className="min-w-0 pr-2">
                                            <p className="text-sm font-semibold text-foreground truncate">{item.medicine_name}</p>
                                            {item.generic_name && (
                                                <p className="text-[10px] font-medium text-muted-foreground mt-0.5 truncate">
                                                    {item.generic_name}
                                                </p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">MRP: ₹{item.mrp}</p>
                                        </div>
                                        <div className={`shrink-0 px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold font-mono tracking-wide ${item.quantity > 0 ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                                            {item.quantity} <span className="hidden sm:inline">IN STOCK</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="p-5 text-center text-sm text-muted-foreground font-medium">
                                {!isSearching && "No matching medicines found."}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Right: Actions & Profile */}
            <div className="flex items-center gap-1 sm:gap-4 shrink-0">

                {/* Global Refresh Button */}
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    title="Sync Data"
                    className="p-2 sm:p-2.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer group shrink-0"
                >
                    <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${isRefreshing ? 'animate-spin text-primary' : 'group-hover:rotate-180'}`} />
                </button>

                {/* Notification Bell */}
                <div className="relative shrink-0" ref={notifRef}>
                    <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="p-2 sm:p-2.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-all relative cursor-pointer group" title="Notifications">
                        <Bell className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                        {notifications.length > 0 && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#F59E0B] border-[1.5px] border-card rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse"></span>
                        )}
                    </button>

                    {isNotifOpen && (
                        <div className="absolute right-[-3rem] sm:right-0 mt-3 w-[calc(100vw-2rem)] max-w-[320px] sm:w-80 bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 z-50">
                            <div className="p-3.5 border-b border-border bg-muted/30 flex justify-between items-center">
                                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    Alerts
                                    <span className="bg-[#F59E0B]/20 text-[#F59E0B] px-2 py-0.5 rounded-full text-[10px] font-bold">{notifications.length}</span>
                                </p>
                                {notifications.length > 0 && (
                                    <button onClick={clearAllNotifications} className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 cursor-pointer">
                                        <CheckCheck className="w-3 h-3" /> Clear All
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                {notifications.length > 0 ? (
                                    <div className="divide-y divide-border/50">
                                        {notifications.map((notif) => (
                                            <div key={notif.id} className="p-4 hover:bg-muted/50 transition-colors flex gap-3 items-start group">
                                                <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                                                <div
                                                    className="flex-1 cursor-pointer min-w-0"
                                                    onClick={() => { setIsNotifOpen(false); router.push('/dashboard/inventory'); }}
                                                >
                                                    <p className="text-sm font-semibold text-foreground leading-tight mb-1.5 truncate">{notif.medicine_name}</p>
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[10px] text-muted-foreground font-mono bg-background border border-border px-1.5 py-0.5 rounded shadow-sm truncate max-w-[120px]">Batch: {notif.batch_number}</p>
                                                        <p className="text-[11px] text-[#F59E0B] font-semibold shrink-0">{notif.quantity} left</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); dismissNotification(notif.id); }}
                                                    className="text-muted-foreground opacity-100 sm:opacity-0 group-hover:opacity-100 hover:text-foreground transition-all p-1 cursor-pointer shrink-0"
                                                    title="Dismiss"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center flex flex-col items-center">
                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                            <Package className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-semibold text-foreground mb-1">You're all caught up!</p>
                                        <p className="text-xs text-muted-foreground">Inventory levels look healthy.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-6 w-px bg-border mx-1 hidden sm:block"></div>

                {/* Profile Badge & Dropdown */}
                <div className="relative shrink-0" ref={profileRef}>
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-3 pl-1 sm:pl-2 hover:opacity-80 transition-opacity cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold text-foreground">Hi, {userName.split(' ')[0]}</p>
                        </div>
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary overflow-hidden shadow-sm shrink-0">
                            {shopLogo ? (
                                <img src={shopLogo} alt="Shop Logo" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-4 h-4 sm:w-5 sm:h-5" />
                            )}
                        </div>
                    </button>

                    {isProfileOpen && (
                        <div className="absolute right-0 mt-3 w-56 bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 z-50">
                            <div className="p-4 border-b border-border bg-muted/30">
                                <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate uppercase tracking-widest font-semibold">{userRole} • {shopName}</p>
                            </div>

                            <div className="p-1.5 bg-card">
                                <button
                                    onClick={() => { setIsProfileOpen(false); router.push('/dashboard/settings'); }}
                                    className="w-full text-left px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                    <Settings className="w-4 h-4" /> Settings & Profile
                                </button>
                                <button
                                    onClick={handleSignOut}
                                    className="w-full text-left px-3 py-2 mt-1 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                    <LogOut className="w-4 h-4" /> Sign Out
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </header>
    );
}