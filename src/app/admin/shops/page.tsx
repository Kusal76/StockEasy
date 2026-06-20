"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Check, X, AlertTriangle, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface MappedShop {
    id: string;
    shop: string;
    owner: string;
    pan: string;
    status: string;
    plan: string;
    joined: string;
    rawDate: Date;
}

const getStatusBadge = (status: string) => {
    switch (status) {
        case "ACTIVE":
            return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider w-24 text-center block shadow-sm">Active</span>;
        case "PENDING":
            return <span className="bg-warning/10 text-warning border border-warning/20 px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider w-24 text-center block shadow-sm">Pending</span>;
        case "SUSPENDED":
            return <span className="bg-destructive/10 text-destructive border border-destructive/20 px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider w-24 text-center block shadow-sm">Suspended</span>;
        case "REJECTED":
            return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted text-muted-foreground text-[11px] font-bold rounded-md border border-border uppercase tracking-wider shadow-sm"><XCircle className="w-3 h-3" /> Rejected</span>
        case "PENDING_DELETION":
            return <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider w-24 text-center block animate-pulse shadow-sm">Deleting</span>;
        default:
            return <span className="bg-muted text-muted-foreground border border-border px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider w-24 text-center block shadow-sm">Unknown</span>;
    }
};

export default function ShopsManagementPage() {
    const router = useRouter();
    const [shopsData, setShopsData] = useState<MappedShop[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [planFilter, setPlanFilter] = useState("ALL");

    // --- APPROVAL/REJECTION/RECOVERY STATES ---
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [shopToReject, setShopToReject] = useState<MappedShop | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    useEffect(() => {
        fetchAllShops();
    }, []);

    const fetchAllShops = async () => {
        try {
            const { data, error } = await supabase
                .from("shops")
                .select(`
                    id, name, pan_number, status, created_at, plan,
                    users (full_name, role)
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;

            if (data) {
                const formattedData: MappedShop[] = data.map((shop: any) => {
                    let ownerName = "Unknown";
                    if (shop.users && shop.users.length > 0) {
                        const owner = shop.users.find((u: any) => u.role === "OWNER") || shop.users[0];
                        ownerName = owner.full_name || "Unknown";
                    }

                    const dateObj = new Date(shop.created_at);
                    const formattedDate = new Intl.DateTimeFormat('en-IN', { month: 'short', day: '2-digit', year: 'numeric' }).format(dateObj);

                    return {
                        id: shop.id,
                        shop: shop.name || "Unnamed Shop",
                        owner: ownerName,
                        pan: shop.pan_number || "N/A",
                        status: shop.status || "PENDING",
                        plan: shop.plan || "STARTER",
                        joined: formattedDate,
                        rawDate: dateObj
                    };
                });

                setShopsData(formattedData);
            }
        } catch (error) {
            console.error("Error fetching shops for directory:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- INLINE RECOVERY HANDLER ---
    const handleInlineRecovery = async (e: React.MouseEvent, shopId: string) => {
        e.stopPropagation(); // Prevent row click from navigating to detailed page
        if (!window.confirm("Recover this account? This will instantly restore all their inventory, staff, and settings, and send them a welcome back email.")) return;

        setProcessingId(shopId);
        try {
            const { error } = await supabase
                .from('shops')
                .update({ status: 'ACTIVE', scheduled_deletion_date: null })
                .eq('id', shopId);

            if (error) throw error;

            await fetch('/api/admin/shops/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shopId: shopId, status: 'ACTIVE', rejectionReason: "" })
            });

            setShopsData(prev => prev.map(s => s.id === shopId ? { ...s, status: 'ACTIVE' } : s));
            alert("Account successfully recovered! The owner can now log in normally.");
            router.refresh();
        } catch (error: any) {
            alert("Failed to recover account: " + error.message);
        } finally {
            setProcessingId(null);
        }
    };

    // --- APPROVAL/REJECTION HANDLERS ---
    const handleApprove = async (e: React.MouseEvent, shopId: string) => {
        e.stopPropagation(); // Prevent row click from navigating
        if (!window.confirm("Approve this shop and send welcome email?")) return;

        setProcessingId(shopId);
        try {
            const res = await fetch('/api/admin/shops/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shopId, status: 'ACTIVE' })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setShopsData(prev => prev.map(s => s.id === shopId ? { ...s, status: 'ACTIVE' } : s));
            alert("Shop Approved! Welcome email dispatched.");
        } catch (error: any) {
            alert("Failed to approve shop: " + error.message);
        } finally {
            setProcessingId(null);
        }
    };

    const openRejectModal = (e: React.MouseEvent, shop: MappedShop) => {
        e.stopPropagation(); // Prevent row click from navigating
        setShopToReject(shop);
        setRejectReason("");
        setRejectModalOpen(true);
    };

    const handleRejectSubmit = async () => {
        if (!shopToReject || !rejectReason.trim()) return;

        setProcessingId(shopToReject.id);
        setRejectModalOpen(false);

        try {
            const res = await fetch('/api/admin/shops/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shopId: shopToReject.id, status: 'REJECTED', rejectionReason: rejectReason })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setShopsData(prev => prev.map(s => s.id === shopToReject.id ? { ...s, status: 'REJECTED' } : s));
            alert("Shop Rejected. Notification email dispatched.");
        } catch (error: any) {
            alert("Failed to reject shop: " + error.message);
        } finally {
            setProcessingId(null);
            setShopToReject(null);
        }
    };

    // FIX: Filtering engine now explicitly excludes REJECTED shops from plan matching
    const filteredShops = shopsData.filter((shop) => {
        const matchesSearch =
            shop.shop.toLowerCase().includes(searchQuery.toLowerCase()) ||
            shop.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
            shop.pan.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === "ALL" || shop.status === statusFilter;

        // If they search "STARTER", do not show rejected shops.
        const matchesPlan = planFilter === "ALL" || (shop.plan === planFilter && shop.status !== "REJECTED");

        return matchesSearch && matchesStatus && matchesPlan;
    });

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500 space-y-8 pb-20 relative transition-colors duration-300">

            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-border">
                <div>
                    <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Tenant Directory</h1>
                    <p className="text-muted-foreground text-sm font-medium">Searchable directory of every pharmacy on the platform.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search shop, owner, PAN..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-full md:w-64 transition-colors placeholder:text-muted-foreground/50 shadow-sm"
                        />
                    </div>

                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer appearance-none min-w-[120px] shadow-sm font-bold">
                        <option value="ALL">All Statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="PENDING">Pending KYC</option>
                        <option value="PENDING_DELETION">Pending Deletion</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="REJECTED">Rejected</option>
                    </select>

                    <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="px-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer appearance-none min-w-[120px] shadow-sm font-bold">
                        <option value="ALL">All Plans</option>
                        <option value="PRO">Pro Tier</option>
                        <option value="GROWTH">Growth Tier</option>
                        <option value="STARTER">Starter Tier</option>
                    </select>
                </div>
            </div>

            {/* Shops Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm min-h-[400px] transition-colors duration-300">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                        <p className="font-mono text-sm tracking-widest uppercase font-bold">Fetching Tenant Records...</p>
                    </div>
                ) : filteredShops.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                        <p className="text-lg font-bold text-foreground">No Tenants Found</p>
                        <p className="text-sm mt-1 font-medium">Try adjusting your filters or search query.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-widest text-muted-foreground font-mono">
                                <th className="px-6 py-4 font-bold">Shop Details</th>
                                <th className="px-6 py-4 font-bold">Owner</th>
                                <th className="px-6 py-4 font-bold">Subscription</th>
                                <th className="px-6 py-4 font-bold text-center">System Status</th>
                                <th className="px-6 py-4 font-bold text-right">Joined / Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filteredShops.map((shop) => (
                                <tr
                                    key={shop.id}
                                    onClick={() => router.push(`/admin/shops/${shop.id}`)}
                                    className="hover:bg-muted/50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">{shop.shop}</div>
                                        <div className="text-[10px] text-muted-foreground font-mono mt-1 font-medium">PAN: {shop.pan}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-foreground font-medium">{shop.owner}</td>
                                    <td className="px-6 py-4">
                                        {/* FIX: If rejected, badge says REVOKED and grays out */}
                                        <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-wider uppercase border shadow-sm ${shop.status === 'REJECTED' ? 'bg-muted text-muted-foreground border-border' :
                                                shop.plan === 'PRO' ? 'bg-primary/10 text-primary border-primary/30' :
                                                    shop.plan === 'GROWTH' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                                                        'bg-muted text-foreground border-border'
                                            }`}>
                                            {shop.status === 'REJECTED' ? 'REVOKED' : shop.plan}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 flex justify-center mt-1.5">{getStatusBadge(shop.status)}</td>

                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {processingId === shop.id ? (
                                                <Loader2 className="w-5 h-5 text-primary animate-spin mr-4" />
                                            ) : shop.status === 'PENDING' ? (
                                                <>
                                                    <button
                                                        onClick={(e) => handleApprove(e, shop.id)}
                                                        title="Approve & Send Email"
                                                        className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 rounded transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Check className="w-4 h-4" strokeWidth={3} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => openRejectModal(e, shop)}
                                                        title="Reject & Request Updates"
                                                        className="p-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border border-destructive/30 rounded transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                                    >
                                                        <X className="w-4 h-4" strokeWidth={3} />
                                                    </button>
                                                </>
                                            ) : shop.status === 'PENDING_DELETION' ? (
                                                <button
                                                    onClick={(e) => handleInlineRecovery(e, shop.id)}
                                                    title="Recover Account & Restore Data"
                                                    className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 rounded transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm opacity-0 group-hover:opacity-100"
                                                >
                                                    <ShieldCheck className="w-4 h-4" strokeWidth={2} /> Recover
                                                </button>
                                            ) : shop.status === 'REJECTED' ? (
                                                <span className="text-sm text-muted-foreground font-mono font-medium">Archived</span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground font-mono font-medium">{shop.joined}</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* REJECTION MODAL */}
            {rejectModalOpen && shopToReject && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 border-b border-border flex items-center gap-3 bg-muted/20">
                            <div className="w-10 h-10 bg-destructive/10 border border-destructive/20 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                                <AlertTriangle className="w-5 h-5 text-destructive" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Reject Application</h2>
                                <p className="text-xs text-muted-foreground font-medium">Shop: <span className="font-bold text-foreground">{shopToReject.shop}</span></p>
                            </div>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-bold text-foreground mb-2">Reason for Rejection (Sent to owner)</label>
                            <textarea
                                rows={4}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="e.g., The uploaded Drug License image is blurry and unreadable. Please upload a clear scan."
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:border-destructive outline-none resize-none placeholder:text-muted-foreground/50 transition-colors shadow-sm"
                            />
                        </div>
                        <div className="p-4 bg-muted/30 border-t border-border flex justify-end gap-3">
                            <button
                                onClick={() => setRejectModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer border border-transparent hover:border-border"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRejectSubmit}
                                disabled={!rejectReason.trim()}
                                className="px-4 py-2 bg-destructive text-white rounded-lg text-sm font-bold hover:bg-destructive/90 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                            >
                                Reject & Send Email
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}