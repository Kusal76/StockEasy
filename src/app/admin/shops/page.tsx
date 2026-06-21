"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Check, X, AlertTriangle, ShieldCheck, XCircle, ChevronDown } from "lucide-react";
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
                <div className="absolute top-full left-0 mt-1.5 w-full sm:min-w-[140px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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

const getStatusBadge = (status: string) => {
    switch (status) {
        case "ACTIVE":
            return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded text-[10px] sm:text-[11px] font-bold uppercase tracking-wider w-20 sm:w-24 text-center block shadow-sm">Active</span>;
        case "PENDING":
            return <span className="bg-warning/10 text-warning border border-warning/20 px-3 py-1 rounded text-[10px] sm:text-[11px] font-bold uppercase tracking-wider w-20 sm:w-24 text-center block shadow-sm">Pending</span>;
        case "SUSPENDED":
            return <span className="bg-destructive/10 text-destructive border border-destructive/20 px-3 py-1 rounded text-[10px] sm:text-[11px] font-bold uppercase tracking-wider w-20 sm:w-24 text-center block shadow-sm">Suspended</span>;
        case "REJECTED":
            return <span className="inline-flex justify-center items-center gap-1 sm:gap-1.5 px-2.5 py-1 bg-muted text-muted-foreground text-[10px] sm:text-[11px] font-bold rounded-md border border-border uppercase tracking-wider shadow-sm w-20 sm:w-24"><XCircle className="w-3 h-3 shrink-0" /> Rejected</span>;
        case "PENDING_DELETION":
            return <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1 rounded text-[10px] sm:text-[11px] font-bold uppercase tracking-wider w-20 sm:w-24 text-center block animate-pulse shadow-sm">Deleting</span>;
        default:
            return <span className="bg-muted text-muted-foreground border border-border px-3 py-1 rounded text-[10px] sm:text-[11px] font-bold uppercase tracking-wider w-20 sm:w-24 text-center block shadow-sm">Unknown</span>;
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

    // Filtering engine explicitly excludes REJECTED shops from plan matching
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
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500 space-y-6 sm:space-y-8 pb-20 relative transition-colors duration-300">

            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 pb-4 border-b border-border">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1.5 sm:mb-2 tracking-tight">Tenant Directory</h1>
                    <p className="text-muted-foreground text-xs sm:text-sm font-medium">Searchable directory of every pharmacy on the platform.</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                    {/* Search Bar */}
                    <div className="relative w-full md:w-64 group">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search shop, owner, PAN..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2.5 sm:py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-full transition-colors placeholder:text-muted-foreground/50 shadow-sm"
                        />
                    </div>

                    {/* CUSTOM DROPDOWNS: Replaced native selects for perfect styling */}
                    <div className="grid grid-cols-2 md:flex items-center gap-3 w-full md:w-auto">
                        <FilterDropdown
                            value={statusFilter}
                            onChange={setStatusFilter}
                            options={[
                                { value: "ALL", label: "All Status" },
                                { value: "ACTIVE", label: "Active" },
                                { value: "PENDING", label: "Pending" },
                                { value: "PENDING_DELETION", label: "Deleting" },
                                { value: "SUSPENDED", label: "Suspended" },
                                { value: "REJECTED", label: "Rejected" },
                            ]}
                        />
                        <FilterDropdown
                            value={planFilter}
                            onChange={setPlanFilter}
                            options={[
                                { value: "ALL", label: "All Plans" },
                                { value: "PRO", label: "Pro Tier" },
                                { value: "GROWTH", label: "Growth Tier" },
                                { value: "STARTER", label: "Starter Tier" },
                            ]}
                        />
                    </div>
                </div>
            </div>

            {/* Shops Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[400px] transition-colors duration-300">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                        <p className="font-mono text-sm tracking-widest uppercase font-bold">Fetching Tenant Records...</p>
                    </div>
                ) : filteredShops.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground p-6 text-center">
                        <p className="text-lg font-bold text-foreground">No Tenants Found</p>
                        <p className="text-sm mt-1 font-medium">Try adjusting your filters or search query.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
                            <thead>
                                <tr className="border-b border-border bg-muted/30 text-[10px] sm:text-[11px] uppercase tracking-widest text-muted-foreground font-mono">
                                    <th className="px-4 sm:px-6 py-4 font-bold">Shop Details</th>
                                    <th className="px-4 sm:px-6 py-4 font-bold">Owner</th>
                                    <th className="px-4 sm:px-6 py-4 font-bold">Subscription</th>
                                    <th className="px-4 sm:px-6 py-4 font-bold text-center">System Status</th>
                                    <th className="px-4 sm:px-6 py-4 font-bold text-right">Joined / Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredShops.map((shop) => (
                                    <tr
                                        key={shop.id}
                                        onClick={() => router.push(`/admin/shops/${shop.id}`)}
                                        className="hover:bg-muted/50 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-4 sm:px-6 py-4">
                                            <div className="font-bold text-foreground group-hover:text-primary transition-colors text-sm truncate max-w-[200px]">{shop.shop}</div>
                                            <div className="text-[10px] text-muted-foreground font-mono mt-1 font-medium">PAN: {shop.pan}</div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-xs sm:text-sm text-foreground font-medium truncate max-w-[150px]">{shop.owner}</td>
                                        <td className="px-4 sm:px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded text-[10px] sm:text-[11px] font-mono font-bold tracking-wider uppercase border shadow-sm ${shop.status === 'REJECTED' ? 'bg-muted text-muted-foreground border-border' :
                                                shop.plan === 'PRO' ? 'bg-primary/10 text-primary border-primary/30' :
                                                    shop.plan === 'GROWTH' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                                                        'bg-muted text-foreground border-border'
                                                }`}>
                                                {shop.status === 'REJECTED' ? 'REVOKED' : shop.plan}
                                            </span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 flex justify-center mt-1.5">{getStatusBadge(shop.status)}</td>

                                        <td className="px-4 sm:px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {processingId === shop.id ? (
                                                    <Loader2 className="w-5 h-5 text-primary animate-spin mr-2 sm:mr-4" />
                                                ) : shop.status === 'PENDING' ? (
                                                    <div className="flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => handleApprove(e, shop.id)}
                                                            title="Approve & Send Email"
                                                            className="p-1.5 sm:p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 rounded transition-all shadow-sm shrink-0"
                                                        >
                                                            <Check className="w-4 h-4" strokeWidth={3} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => openRejectModal(e, shop)}
                                                            title="Reject & Request Updates"
                                                            className="p-1.5 sm:p-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border border-destructive/30 rounded transition-all shadow-sm shrink-0"
                                                        >
                                                            <X className="w-4 h-4" strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                ) : shop.status === 'PENDING_DELETION' ? (
                                                    <button
                                                        onClick={(e) => handleInlineRecovery(e, shop.id)}
                                                        title="Recover Account & Restore Data"
                                                        className="px-2.5 sm:px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 rounded transition-all flex items-center gap-1.5 text-[10px] sm:text-xs font-bold shadow-sm opacity-100 lg:opacity-0 lg:group-hover:opacity-100 shrink-0"
                                                    >
                                                        <ShieldCheck className="w-3.5 h-3.5 sm:w-4 h-4" strokeWidth={2} /> Recover
                                                    </button>
                                                ) : shop.status === 'REJECTED' ? (
                                                    <span className="text-xs sm:text-sm text-muted-foreground font-mono font-medium">Archived</span>
                                                ) : (
                                                    <span className="text-xs sm:text-sm text-muted-foreground font-mono font-medium">{shop.joined}</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* REJECTION MODAL */}
            {rejectModalOpen && shopToReject && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        <div className="p-4 sm:p-6 border-b border-border flex items-center gap-3 bg-muted/20 shrink-0">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-destructive/10 border border-destructive/20 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                            </div>
                            <div className="min-w-0 pr-2">
                                <h2 className="text-base sm:text-lg font-bold text-foreground">Reject Application</h2>
                                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">Shop: <span className="font-bold text-foreground">{shopToReject.shop}</span></p>
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar">
                            <label className="block text-xs sm:text-sm font-bold text-foreground mb-2">Reason for Rejection (Sent to owner)</label>
                            <textarea
                                rows={4}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="e.g., The uploaded Drug License image is blurry and unreadable. Please upload a clear scan."
                                className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-foreground text-xs sm:text-sm focus:border-destructive outline-none resize-none placeholder:text-muted-foreground/50 transition-colors shadow-sm"
                            />
                        </div>
                        <div className="p-4 bg-muted/30 border-t border-border flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setRejectModalOpen(false)}
                                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer border border-transparent hover:border-border"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRejectSubmit}
                                disabled={!rejectReason.trim()}
                                className="w-full sm:w-auto px-5 sm:px-4 py-2.5 sm:py-2 bg-destructive text-white rounded-lg text-sm font-bold hover:bg-destructive/90 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
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