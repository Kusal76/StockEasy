"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { Loader2, Search, ShieldAlert, Activity, Users, CreditCard, Power, PowerOff, RefreshCw, CalendarDays, Clock, AlertTriangle, XCircle, ChevronDown } from "lucide-react";

interface Shop {
    id: string;
    name: string;
    email_address: string;
    contact_number: string;
    plan: string;
    status: string;
    created_at: string;
}

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
        <div className="relative w-full md:w-auto shrink-0" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-background border border-border rounded-lg flex items-center justify-between px-3 py-2.5 shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20 md:min-w-[130px]"
            >
                <span className="text-foreground text-sm font-bold truncate pr-4">{selectedLabel}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-full md:min-w-[130px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-muted ${value === opt.value ? 'bg-primary/10 text-primary font-bold' : 'text-foreground font-medium'}`}
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

export default function SuperAdminDashboard() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [shops, setShops] = useState<Shop[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [planFilter, setPlanFilter] = useState<"ALL" | "STARTER" | "GROWTH" | "PRO">("ALL");

    // Store profile info for personalized dashboard
    const [adminProfile, setAdminProfile] = useState<{ full_name: string, role: string } | null>(null);

    const [metrics, setMetrics] = useState({ totalMrr: 0, activeShops: 0, suspendedShops: 0, pendingShops: 0 });

    useEffect(() => {
        verifySuperAdminAndFetch();
    }, []);

    const verifySuperAdminAndFetch = async () => {
        setIsRefreshing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");

            // --- STRICT VAULT CHECK ---
            // Only platform_admins are allowed here. No fallbacks.
            const { data: platformAdmin } = await supabase
                .from('platform_admins')
                .select('role, is_active, full_name, requires_password_change')
                .eq('id', user.id)
                .maybeSingle();

            if (!platformAdmin || !platformAdmin.is_active) {
                console.warn("User is not an active platform admin. Kicking to login.");
                return router.push("/login");
            }

            // --- SECURITY INTERCEPTOR ---
            if (platformAdmin.requires_password_change) {
                return router.push("/admin/setup-password");
            }

            setAdminProfile(platformAdmin);

            // --- REST OF YOUR EXISTING FETCH CODE ---
            const { data: allShops, error } = await supabase
                .from('shops')
                .select('*, users(email, contact_number, role)')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (allShops) {
                const processedShops = allShops.map((shop: any) => {
                    let ownerEmail = shop.email_address;
                    let ownerPhone = shop.contact_number;

                    if (shop.users && shop.users.length > 0) {
                        const owner = shop.users.find((u: any) => u.role === 'OWNER') || shop.users[0];
                        if (!ownerEmail && owner.email) ownerEmail = owner.email;
                        if (!ownerPhone && owner.contact_number) ownerPhone = owner.contact_number;
                    }

                    return {
                        ...shop,
                        email_address: ownerEmail,
                        contact_number: ownerPhone
                    };
                });

                setShops(processedShops);
                calculateMetrics(processedShops);
            }
        } catch (error) {
            console.error("Admin fetch error:", error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const calculateMetrics = (allShops: Shop[]) => {
        let mrr = 0;
        let active = 0;
        let suspended = 0;
        let pending = 0;

        allShops.forEach(shop => {
            if (shop.status === 'SUSPENDED') {
                suspended++;
            } else if (shop.status === 'PENDING') {
                pending++;
            } else if (shop.status === 'ACTIVE') {
                active++;
                if (shop.plan === "PRO") mrr += 1499;
                if (shop.plan === "GROWTH") mrr += 599;
            }
        });

        setMetrics({ totalMrr: mrr, activeShops: active, suspendedShops: suspended, pendingShops: pending });
    };

    const toggleShopStatus = async (shopId: string, currentStatus: string, shopName: string) => {
        // We determine the intended ACTION rather than calculating the new status on the client.
        const action = currentStatus === "SUSPENDED" ? "RESTORE" : "SUSPEND";
        const confirmMsg = action === "SUSPEND"
            ? `WARNING: This will instantly lock ${shopName} out of their dashboard. Proceed?`
            : `Reactivate access for ${shopName}?`;

        if (!window.confirm(confirmMsg)) return;

        // Optional: Add a temporary processing state UI here if desired, 
        // though optimistic updates generally feel faster.

        try {
            const res = await fetch('/api/admin/shops/toggle-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shopId, action })
            });

            const data = await res.json();

            if (!res.ok) {
                // If it's a 409 Conflict, show the specific collision warning
                throw new Error(data.error || "Failed to update shop access.");
            }

            // Successfully updated via API. Now update local UI state.
            const updatedShops = shops.map(s => s.id === shopId ? { ...s, status: data.newStatus } : s);
            setShops(updatedShops);
            calculateMetrics(updatedShops);
        } catch (error: any) {
            console.error("Status update error:", error);
            alert(error.message);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    };

    const filteredShops = shops.filter(shop => {
        const matchesSearch = shop.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            shop.email_address?.toLowerCase().includes(searchQuery.toLowerCase());

        // Use effective plan but explicitly block REJECTED shops from plan filters
        const effectivePlan = shop.plan || "STARTER";
        const matchesPlan = planFilter === "ALL" || (effectivePlan === planFilter && shop.status !== "REJECTED");

        return matchesSearch && matchesPlan;
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] bg-background text-muted-foreground transition-colors duration-300">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p className="font-mono text-sm tracking-widest uppercase font-bold">Authenticating Admin...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 transition-colors pb-10">

            {/* Admin Header - Personalized based on Role */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-border">
                <div>
                    <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                        <ShieldAlert className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${adminProfile?.role === 'SUPERADMIN' ? 'text-destructive' : 'text-primary'}`} />
                        <span className={`text-[9px] sm:text-[10px] font-mono font-bold tracking-widest uppercase ${adminProfile?.role === 'SUPERADMIN' ? 'text-destructive' : 'text-primary'}`}>
                            {adminProfile?.role === 'SUPERADMIN' ? 'Level 4 Clearance Active' : 'Level 3 Clearance Active'}
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Welcome, {adminProfile?.full_name || 'Admin'}</h1>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-1 font-medium">Global SaaS metrics and top-level tenant monitoring.</p>
                </div>
                <button
                    onClick={verifySuperAdminAndFetch}
                    disabled={isRefreshing}
                    className="w-full md:w-auto px-4 py-2.5 sm:py-2 bg-card hover:bg-muted border border-border text-foreground text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
                    {isRefreshing ? "Syncing..." : "Sync Data"}
                </button>
            </div>

            {/* SaaS Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="bg-card border border-primary/30 p-4 sm:p-6 rounded-2xl shadow-sm relative overflow-hidden transition-colors duration-300">
                    <CreditCard className="w-12 h-12 sm:w-16 sm:h-16 absolute -right-3 -bottom-3 sm:-right-4 sm:-bottom-4 text-primary/10" />
                    <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-1.5 sm:mb-2 uppercase tracking-wider">Active MRR</p>
                    <p className="text-xl sm:text-3xl font-bold text-foreground">₹{metrics.totalMrr.toLocaleString()}</p>
                </div>
                <div className="bg-card border border-emerald-500/30 p-4 sm:p-6 rounded-2xl shadow-sm relative overflow-hidden transition-colors duration-300">
                    <Activity className="w-12 h-12 sm:w-16 sm:h-16 absolute -right-3 -bottom-3 sm:-right-4 sm:-bottom-4 text-emerald-500/10" />
                    <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-1.5 sm:mb-2 uppercase tracking-wider">Active Tenants</p>
                    <p className="text-xl sm:text-3xl font-bold text-foreground">{metrics.activeShops}</p>
                </div>
                <div className="bg-card border border-warning/30 p-4 sm:p-6 rounded-2xl shadow-sm relative overflow-hidden transition-colors duration-300">
                    <Clock className="w-12 h-12 sm:w-16 sm:h-16 absolute -right-3 -bottom-3 sm:-right-4 sm:-bottom-4 text-warning/10" />
                    <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-1.5 sm:mb-2 uppercase tracking-wider">Pending KYC</p>
                    <p className="text-xl sm:text-3xl font-bold text-warning">{metrics.pendingShops}</p>
                </div>
                <div className="bg-card border border-destructive/30 p-4 sm:p-6 rounded-2xl shadow-sm relative overflow-hidden transition-colors duration-300">
                    <Users className="w-12 h-12 sm:w-16 sm:h-16 absolute -right-3 -bottom-3 sm:-right-4 sm:-bottom-4 text-destructive/5" />
                    <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-1.5 sm:mb-2 uppercase tracking-wider">Suspended</p>
                    <p className="text-xl sm:text-3xl font-bold text-destructive">{metrics.suspendedShops}</p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4 justify-between items-start md:items-center bg-card p-3 sm:p-4 rounded-xl border border-border shadow-sm transition-colors duration-300">
                <div className="relative w-full md:flex-1 group">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search pharmacy name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-background hover:bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    />
                </div>

                {/* Custom Filter Dropdown */}
                <FilterDropdown
                    value={planFilter}
                    onChange={(val) => setPlanFilter(val as any)}
                    options={[
                        { value: "ALL", label: "All Plans" },
                        { value: "PRO", label: "Pro Tier" },
                        { value: "GROWTH", label: "Growth Tier" },
                        { value: "STARTER", label: "Starter Tier" },
                    ]}
                />
            </div>

            {/* Tenant Data Table */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-colors duration-300 flex flex-col">
                <div className="overflow-x-auto custom-scrollbar flex-1">
                    <table className="w-full border-collapse whitespace-nowrap text-left min-w-[900px]">
                        <thead>
                            <tr className="text-[10px] tracking-widest text-muted-foreground font-mono uppercase border-b border-border bg-muted/30">
                                <th className="px-6 py-4 font-bold">Pharmacy Profile</th>
                                <th className="px-6 py-4 font-bold">Contact Info</th>
                                <th className="px-6 py-4 font-bold">Subscription</th>
                                <th className="px-6 py-4 font-bold text-center">System Status</th>
                                <th className="px-6 py-4 font-bold text-right">Admin Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredShops.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm font-medium">
                                        No tenant records found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredShops.map((shop) => (
                                    <tr key={shop.id} className="hover:bg-muted/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-foreground text-sm">{shop.name || "Unnamed Shop"}</div>
                                            <div className="text-[11px] text-muted-foreground font-mono mt-1 flex items-center gap-1.5 font-medium">
                                                <CalendarDays className="w-3 h-3" /> Joined {formatDate(shop.created_at)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-foreground font-medium">{shop.email_address || "N/A"}</div>
                                            <div className="text-xs text-muted-foreground font-mono mt-0.5">{shop.contact_number || "No Phone"}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${shop.status === 'REJECTED' ? 'bg-muted text-muted-foreground border-border' :
                                                shop.plan === 'PRO' ? 'bg-primary/10 text-primary border-primary/30' :
                                                    shop.plan === 'GROWTH' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                                                        'bg-muted text-foreground border-border'
                                                }`}>
                                                {shop.status === 'REJECTED' ? 'REVOKED' : (shop.plan || "STARTER")}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {shop.status === "SUSPENDED" ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-destructive/10 text-destructive text-[11px] font-bold rounded-md border border-destructive/20 uppercase tracking-wider shadow-sm">
                                                    <PowerOff className="w-3 h-3" /> Suspended
                                                </span>
                                            ) : shop.status === "PENDING" ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-warning/10 text-warning text-[11px] font-bold rounded-md border border-warning/20 uppercase tracking-wider shadow-sm">
                                                    <Clock className="w-3 h-3" /> Pending
                                                </span>
                                            ) : shop.status === "PENDING_DELETION" ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-500 text-[11px] font-bold rounded-md border border-red-500/20 uppercase tracking-wider animate-pulse shadow-sm">
                                                    <AlertTriangle className="w-3 h-3" /> Deleting
                                                </span>
                                            ) : shop.status === "REJECTED" ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted text-muted-foreground text-[11px] font-bold rounded-md border border-border uppercase tracking-wider shadow-sm">
                                                    <XCircle className="w-3 h-3" /> Rejected
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[11px] font-bold rounded-md border border-emerald-500/20 uppercase tracking-wider shadow-sm">
                                                    <Activity className="w-3 h-3" /> Active
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                {shop.status === "PENDING" ? (
                                                    <button
                                                        onClick={() => router.push(`/admin/verification/${shop.id}`)}
                                                        className="px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ml-auto transition-colors bg-warning/10 text-warning border border-warning/20 hover:bg-warning hover:text-white cursor-pointer shadow-sm"
                                                    >
                                                        Review KYC
                                                    </button>
                                                ) : shop.status === "PENDING_DELETION" ? (
                                                    <button
                                                        onClick={() => router.push(`/admin/verification/${shop.id}`)}
                                                        className="px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ml-auto transition-colors bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white cursor-pointer shadow-sm"
                                                    >
                                                        Manage Deletion
                                                    </button>
                                                ) : shop.status === "REJECTED" ? (
                                                    <span className="text-sm text-muted-foreground font-mono font-medium">Archived</span>
                                                ) : (
                                                    <button
                                                        onClick={() => toggleShopStatus(shop.id, shop.status, shop.name)}
                                                        className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ml-auto transition-colors cursor-pointer shadow-sm ${shop.status === "SUSPENDED"
                                                            ? "bg-card border border-border hover:bg-muted text-foreground"
                                                            : "bg-destructive/10 border border-destructive/20 hover:bg-destructive text-destructive hover:text-white"
                                                            }`}
                                                    >
                                                        {shop.status === "SUSPENDED" ? (
                                                            <>Restore Access</>
                                                        ) : (
                                                            <><Power className="w-3 h-3" /> Suspend Auth</>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}