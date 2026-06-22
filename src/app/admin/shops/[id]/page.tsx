"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Store, User, Package, Users, Receipt, CreditCard,
    CalendarDays, Loader2, Database, ShieldAlert, XCircle
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

type TabType = "inventory" | "staff" | "bills" | "invoices";

export default function TenantProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const id = resolvedParams.id;
    const router = useRouter();

    const [shopData, setShopData] = useState<any>(null);
    const [ownerData, setOwnerData] = useState<any>(null);

    // Detailed Data States
    const [inventoryList, setInventoryList] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [billsList, setBillsList] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>("inventory");

    const [metrics, setMetrics] = useState({ inventoryCount: 0, staffCount: 0, totalRevenue: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

    useEffect(() => {
        fetchComprehensiveTenantData();
    }, [id]);

    const fetchComprehensiveTenantData = async () => {
        setIsLoading(true);
        try {
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

            // Call our new secure backend API
            const res = await fetch(`/api/admin/shops/${id}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            setShopData(data.shop);
            if (data.shop.users && data.shop.users.length > 0) {
                const owner = data.shop.users.find((u: any) => u.role === "OWNER") || data.shop.users[0];
                setOwnerData(owner);
            }

            setInventoryList(data.inventory);
            setStaffList(data.staff);
            setBillsList(data.bills);

            const totalRev = data.bills ? data.bills.reduce((sum: number, bill: any) => sum + Number(bill.total_amount), 0) : 0;

            setMetrics({
                inventoryCount: data.inventoryCount,
                staffCount: data.staffCount,
                totalRevenue: totalRev
            });

        } catch (error) {
            console.error("Error fetching tenant profile:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualPlanOverride = async (newPlan: string) => {
        const confirmMsg = `WARNING: You are about to manually override this tenant's subscription to the ${newPlan} tier. This bypasses the payment gateway. Proceed?`;
        if (!window.confirm(confirmMsg)) return;

        setIsUpdatingPlan(true);
        try {
            const res = await fetch(`/api/admin/shops/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPlan })
            });

            if (!res.ok) throw new Error("Failed to update plan");

            // Update local state instantly so UI reflects the change
            setShopData((prev: any) => ({ ...prev, plan: newPlan }));
            alert(`Success! Tenant has been manually upgraded to ${newPlan}.`);
        } catch (error) {
            console.error("Failed to override plan:", error);
            alert("Database error: Could not update the subscription plan.");
        } finally {
            setIsUpdatingPlan(false);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    };

    const formatDateTime = (dateString: string) => {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground transition-colors">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p className="font-mono text-sm tracking-widest uppercase font-bold text-center px-4">Bypassing RLS & Compiling Tenant Data...</p>
            </div>
        );
    }

    if (!shopData) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground transition-colors px-4 text-center">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Tenant Not Found</h1>
                <p className="mb-6 font-medium text-sm sm:text-base">The shop ID #{id} does not exist in the system.</p>
                <Link href="/admin/shops" className="text-primary hover:underline font-bold">Return to Directory</Link>
            </div>
        );
    }

    const isRejected = shopData.status === "REJECTED";

    return (
        <div className="max-w-6xl animate-in fade-in duration-500 space-y-6 sm:space-y-8 pb-20 transition-colors">

            {/* Header - FIX: Stacked on mobile */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 pb-4 border-b border-border gap-4">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <Link
                        href="/admin/shops"
                        className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 bg-card border border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors cursor-pointer shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight flex flex-wrap items-center gap-2 sm:gap-3 leading-tight">
                            {shopData.name || "Unnamed Shop"}
                            {shopData.status === "ACTIVE" ? (
                                <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-sm shrink-0">Active</span>
                            ) : isRejected ? (
                                <span className="bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1 shrink-0"><XCircle className="w-3 h-3" /> Rejected</span>
                            ) : (
                                <span className="bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-sm shrink-0">{shopData.status}</span>
                            )}
                        </h1>
                        <p className="text-muted-foreground text-xs sm:text-sm font-mono mt-1 font-medium truncate">Tenant ID: {shopData.id}</p>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 sm:gap-8">

                {/* Column 1: Core Profiles */}
                <div className="md:col-span-1 space-y-6">
                    {/* Business Profile */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border bg-muted/20 flex items-center gap-3">
                            <Store className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            <h2 className="font-bold text-foreground text-sm sm:text-base">Business Profile</h2>
                        </div>
                        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                            <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Business Type</p>
                                <p className="text-xs sm:text-sm font-bold text-foreground">{shopData.business_type || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">PAN Number</p>
                                <p className="text-xs sm:text-sm font-mono text-foreground uppercase font-medium">{shopData.pan_number || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">GST Number</p>
                                <p className="text-xs sm:text-sm font-mono text-foreground uppercase font-medium">{shopData.gst_number || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Drug License</p>
                                <p className="text-xs sm:text-sm font-mono text-foreground uppercase font-medium break-all">{shopData.license_number || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Business Email</p>
                                <p className="text-xs sm:text-sm text-foreground font-medium break-all">{shopData.email_address || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Contact Number</p>
                                <p className="text-xs sm:text-sm text-foreground font-medium">{shopData.contact_number || ownerData?.contact_number || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Address</p>
                                <p className="text-xs sm:text-sm text-foreground font-medium leading-snug">{shopData.address || "N/A"}</p>
                            </div>
                        </div>
                    </div>

                    {/* Owner Profile */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border bg-muted/20 flex items-center gap-3">
                            <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            <h2 className="font-bold text-foreground text-sm sm:text-base">Owner Information</h2>
                        </div>
                        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                            <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Full Name</p>
                                <p className="text-xs sm:text-sm font-bold text-foreground">{ownerData?.full_name || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Email</p>
                                <p className="text-xs sm:text-sm text-foreground font-medium break-all">{ownerData?.email || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Contact Number</p>
                                <p className="text-xs sm:text-sm text-foreground font-medium">{ownerData?.contact_number || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1 font-bold">Joined Date</p>
                                <p className="text-xs sm:text-sm text-foreground flex items-center gap-2 font-medium">
                                    <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
                                    {formatDate(shopData.created_at)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 2: Usage Metrics & SaaS Info */}
                <div className="md:col-span-2 space-y-6">

                    {/* Platform Usage Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-card border border-border p-4 sm:p-5 rounded-xl shadow-sm relative overflow-hidden group">
                            <Package className="w-12 h-12 sm:w-16 sm:h-16 absolute -right-2 -bottom-2 text-muted-foreground/10 group-hover:scale-110 transition-transform" />
                            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">Inventory Items</p>
                            <p className="text-2xl sm:text-3xl font-bold text-foreground">{metrics.inventoryCount}</p>
                        </div>
                        <div className="bg-card border border-border p-4 sm:p-5 rounded-xl shadow-sm relative overflow-hidden group">
                            <Users className="w-12 h-12 sm:w-16 sm:h-16 absolute -right-2 -bottom-2 text-muted-foreground/10 group-hover:scale-110 transition-transform" />
                            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">Active Staff</p>
                            <p className="text-2xl sm:text-3xl font-bold text-foreground">{metrics.staffCount}</p>
                        </div>
                        <div className="bg-card border border-primary/30 p-4 sm:p-5 rounded-xl shadow-sm relative overflow-hidden group">
                            <Receipt className="w-12 h-12 sm:w-16 sm:h-16 absolute -right-2 -bottom-2 text-primary/10 group-hover:scale-110 transition-transform" />
                            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">Processed GMV</p>
                            <p className="text-2xl sm:text-3xl font-bold text-foreground">₹{metrics.totalRevenue.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* --- UPGRADED: Subscription & Billing Manual Override --- */}
                    <div className="bg-card border border-primary/30 rounded-xl overflow-hidden shadow-sm relative">
                        <div className={`absolute top-0 left-0 w-1 h-full ${isRejected ? 'bg-muted-foreground' : 'bg-primary'}`} />
                        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <CreditCard className={`w-4 h-4 sm:w-5 sm:h-5 ${isRejected ? 'text-muted-foreground' : 'text-primary'}`} />
                                <h2 className="font-bold text-foreground text-sm sm:text-base">Subscription Governance</h2>
                            </div>
                            <span className={`px-2 sm:px-3 py-1 rounded text-[9px] sm:text-[10px] font-mono font-bold tracking-wider uppercase border shadow-sm ${isRejected ? 'bg-muted text-muted-foreground border-border' :
                                shopData.plan === 'PRO' ? 'bg-primary/10 text-primary border-primary/30' :
                                    shopData.plan === 'GROWTH' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                                        'bg-muted text-foreground border-border'
                                }`}>
                                CURRENT: {isRejected ? 'REVOKED' : (shopData.plan || "STARTER")}
                            </span>
                        </div>
                        <div className="p-4 sm:p-6">
                            <div className="flex items-start gap-3 mb-5 sm:mb-6">
                                <ShieldAlert className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5 ${isRejected ? 'text-muted-foreground' : 'text-warning'}`} />
                                <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed">
                                    {isRejected
                                        ? "This tenant application was rejected. Subscription overrides and manual billing controls are permanently disabled for this account."
                                        : "If a payment gateway failure occurs, you can manually override this tenant's subscription tier below. This will instantly unlock or restrict dashboard features for the pharmacy owner."
                                    }
                                </p>
                            </div>

                            {/* FIX: Full width buttons on mobile */}
                            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                                <button
                                    onClick={() => handleManualPlanOverride("STARTER")}
                                    disabled={isUpdatingPlan || isRejected || shopData.plan === "STARTER"}
                                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-background hover:bg-muted border border-border text-foreground text-sm font-bold rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                                >
                                    Force Starter
                                </button>
                                <button
                                    onClick={() => handleManualPlanOverride("GROWTH")}
                                    disabled={isUpdatingPlan || isRejected || shopData.plan === "GROWTH"}
                                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-500 text-sm font-bold rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                                >
                                    Force Growth
                                </button>
                                <button
                                    onClick={() => handleManualPlanOverride("PRO")}
                                    disabled={isUpdatingPlan || isRejected || shopData.plan === "PRO"}
                                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-sm font-bold rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                                >
                                    Force Pro
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* --- DEEP DIVE DATA VIEWER --- */}
                    <div className="mt-8 space-y-4">
                        <h3 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                            <Database className="w-5 h-5 text-primary" /> Database Inspector
                        </h3>

                        {/* Tabs - FIX: Scrollable wrapper for mobile */}
                        <div className="flex overflow-x-auto custom-scrollbar gap-2 p-1 bg-card border border-border rounded-lg w-full sm:w-fit shadow-sm whitespace-nowrap">
                            <button
                                onClick={() => setActiveTab("inventory")}
                                className={`px-4 py-2 rounded-md text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${activeTab === "inventory" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                            >
                                Inventory ({metrics.inventoryCount})
                            </button>
                            <button
                                onClick={() => setActiveTab("staff")}
                                className={`px-4 py-2 rounded-md text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${activeTab === "staff" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                            >
                                Staff ({metrics.staffCount})
                            </button>
                            <button
                                onClick={() => setActiveTab("bills")}
                                className={`px-4 py-2 rounded-md text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${activeTab === "bills" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                            >
                                Recent Bills
                            </button>
                            <button
                                onClick={() => setActiveTab("invoices")}
                                className={`px-4 py-2 rounded-md text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${activeTab === "invoices" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                            >
                                Payment Ledger
                            </button>
                        </div>

                        {/* Tab Content: Inventory */}
                        {activeTab === "inventory" && (
                            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-300">
                                {/* FIX: Ensure table scrolling with min-w */}
                                <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                                    <table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px]">
                                        <thead className="sticky top-0 bg-card shadow-sm z-10">
                                            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono border-b border-border bg-muted/30">
                                                <th className="px-4 sm:px-6 py-4 font-bold">Item Name</th>
                                                <th className="px-4 sm:px-6 py-4 font-bold">Category</th>
                                                <th className="px-4 sm:px-6 py-4 font-bold text-center">In Stock</th>
                                                <th className="px-4 sm:px-6 py-4 font-bold text-right">MRP</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {inventoryList.length === 0 ? (
                                                <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm font-medium">No inventory records found.</td></tr>
                                            ) : (
                                                inventoryList.map((item) => (
                                                    <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                                                        <td className="px-4 sm:px-6 py-3 font-bold text-foreground text-xs sm:text-sm">
                                                            {item.medicine_name}
                                                            <div className="text-[9px] sm:text-[10px] text-muted-foreground font-mono mt-0.5 font-medium">Batch: {item.batch_number}</div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-3 text-xs sm:text-sm text-muted-foreground font-medium">{item.category}</td>
                                                        <td className="px-4 sm:px-6 py-3 text-center text-xs sm:text-sm font-mono text-foreground font-medium">{item.quantity}</td>
                                                        <td className="px-4 sm:px-6 py-3 text-right text-xs sm:text-sm text-emerald-500 font-mono font-bold">₹{item.mrp}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Tab Content: Staff */}
                        {activeTab === "staff" && (
                            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-300">
                                <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                                    <table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px]">
                                        <thead className="sticky top-0 bg-card shadow-sm z-10">
                                            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono border-b border-border bg-muted/30">
                                                <th className="px-4 sm:px-6 py-4 font-bold">Staff Name</th>
                                                <th className="px-4 sm:px-6 py-4 font-bold">Email</th>
                                                <th className="px-4 sm:px-6 py-4 font-bold">Role</th>
                                                <th className="px-4 sm:px-6 py-4 font-bold">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {staffList.length === 0 ? (
                                                <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm font-medium">No secondary staff members found.</td></tr>
                                            ) : (
                                                staffList.map((staff) => (
                                                    <tr key={staff.id} className="hover:bg-muted/50 transition-colors">
                                                        <td className="px-4 sm:px-6 py-3 font-bold text-foreground text-xs sm:text-sm">{staff.name}</td>
                                                        <td className="px-4 sm:px-6 py-3 text-xs sm:text-sm text-muted-foreground font-medium">{staff.email}</td>
                                                        <td className="px-4 sm:px-6 py-3">
                                                            <span className="bg-muted border border-border text-foreground px-2.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold tracking-wider">{staff.role}</span>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-3">
                                                            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold">
                                                                <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${staff.status === 'ACTIVE' ? 'bg-primary' : 'bg-destructive'}`} />
                                                                <span className={staff.status === 'ACTIVE' ? 'text-foreground' : 'text-destructive'}>{staff.status}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Tab Content: Bills */}
                        {activeTab === "bills" && (
                            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-300">
                                <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                                    <table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px]">
                                        <thead className="sticky top-0 bg-card shadow-sm z-10">
                                            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono border-b border-border bg-muted/30">
                                                <th className="px-4 sm:px-6 py-4 font-bold">Transaction Date</th>
                                                <th className="px-4 sm:px-6 py-4 font-bold">Customer Name</th>
                                                <th className="px-4 sm:px-6 py-4 font-bold">Payment Mode</th>
                                                <th className="px-4 sm:px-6 py-4 font-bold text-right">Total Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {billsList.length === 0 ? (
                                                <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm font-medium">No transaction history found.</td></tr>
                                            ) : (
                                                billsList.map((bill) => (
                                                    <tr key={bill.id} className="hover:bg-muted/50 transition-colors">
                                                        <td className="px-4 sm:px-6 py-3 text-xs sm:text-sm text-muted-foreground font-mono font-medium">{formatDateTime(bill.created_at)}</td>
                                                        <td className="px-4 sm:px-6 py-3 font-bold text-foreground text-xs sm:text-sm">{bill.customer_name || "Guest"}</td>
                                                        <td className="px-4 sm:px-6 py-3 text-muted-foreground uppercase text-[9px] sm:text-[11px] font-bold">{bill.payment_method || "N/A"}</td>
                                                        <td className="px-4 sm:px-6 py-3 text-right text-xs sm:text-sm font-bold text-emerald-500 font-mono">₹{bill.total_amount}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Tab Content: Invoices Ledger */}
                        {activeTab === "invoices" && (
                            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-300 p-8 sm:p-12 flex flex-col items-center justify-center text-center">
                                <Receipt className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/30 mb-4" />
                                <h4 className="text-base sm:text-lg font-bold text-foreground mb-2">Payment Ledger Coming Soon</h4>
                                <p className="text-xs sm:text-sm text-muted-foreground max-w-md font-medium px-2">
                                    Once the Razorpay Webhook architecture is fully deployed, all successful and failed subscription payment intents will automatically log here for administrative review.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}