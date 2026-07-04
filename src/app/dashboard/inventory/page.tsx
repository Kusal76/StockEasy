"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useSearchParams } from "next/navigation";
import { Search, Loader2, Trash2, Edit, AlertTriangle, X, Save, PackageSearch } from "lucide-react";

interface InventoryItem {
    id: string;
    medicine_name: string;
    category: string;
    batch_number: string;
    quantity: number;
    mrp: number;
    expiry_date: string;
    dealer_name: string;
    status?: "OK" | "Expiring" | "Out" | "Dead";
}

export default function InventoryOverviewPage() {
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [shopId, setShopId] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [dealerSearch, setDealerSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState<"All" | "Expiring" | "Out" | "Dead" | "Dealer">("All");

    const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
    const [displayData, setDisplayData] = useState<InventoryItem[]>([]);

    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [kpis, setKpis] = useState({ skus: 0, expiring: 0, out: 0, dead: 0 });

    useEffect(() => {
        const filterParam = searchParams.get('filter');
        if (filterParam === 'expiring') {
            setActiveFilter("Expiring");
        }
    }, [searchParams]);

    const fetchInventory = useCallback(async (currentShopId: string) => {
        try {
            const { data, error } = await supabase
                .from('inventory')
                .select('id, medicine_name, category, batch_number, quantity, mrp, expiry_date, dealer_name')
                .eq('shop_id', currentShopId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) processRawData(data as InventoryItem[]);
        } catch (error) {
            console.error("Error fetching inventory:", error);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        let realtimeChannel: any;

        const initialize = async () => {
            setIsLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: userData } = await supabase.from('users').select('shop_id').eq('id', user.id).single();
            if (!userData?.shop_id) return;

            setShopId(userData.shop_id);
            await fetchInventory(userData.shop_id);
            if (isMounted) setIsLoading(false);

            const uniqueChannelName = `inventory-grid-${userData.shop_id}-${Date.now()}`;

            realtimeChannel = supabase.channel(uniqueChannelName)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `shop_id=eq.${userData.shop_id}` }, () => {
                    if (isMounted) fetchInventory(userData.shop_id);
                })
                .subscribe();
        };

        initialize();

        return () => {
            isMounted = false;
            if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        };
    }, [fetchInventory]);

    const processRawData = (rawData: InventoryItem[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const ninetyDaysFromNow = new Date(today);
        ninetyDaysFromNow.setDate(today.getDate() + 90);

        const uniqueMedicines = new Set<string>();

        const processedArray = rawData.map(item => {
            const expDate = new Date(item.expiry_date);
            uniqueMedicines.add(item.medicine_name);

            if (item.quantity <= 0) {
                item.status = "Out";
            } else if (expDate < today) {
                item.status = "Dead";
            } else if (expDate <= ninetyDaysFromNow) {
                item.status = "Expiring";
            } else {
                item.status = "OK";
            }
            return item;
        });

        const expiringCount = processedArray.filter(i => i.status === "Expiring").length;
        const outCount = processedArray.filter(i => i.status === "Out").length;
        const deadCount = processedArray.filter(i => i.status === "Dead").length;

        setKpis({ skus: uniqueMedicines.size, expiring: expiringCount, out: outCount, dead: deadCount });
        setInventoryData(processedArray);
    };

    useEffect(() => {
        let filtered = inventoryData;

        if (activeFilter === "Expiring") filtered = filtered.filter(i => i.status === "Expiring");
        if (activeFilter === "Out") filtered = filtered.filter(i => i.status === "Out");
        if (activeFilter === "Dead") filtered = filtered.filter(i => i.status === "Dead");
        if (activeFilter === "Dealer" && dealerSearch.trim() !== "") {
            const lowerDealer = dealerSearch.toLowerCase();
            filtered = filtered.filter(i => i.dealer_name?.toLowerCase().includes(lowerDealer));
        }

        if (searchQuery.trim().length > 0) {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(i =>
                i.medicine_name.toLowerCase().includes(lowerQuery) ||
                i.batch_number.toLowerCase().includes(lowerQuery)
            );
        }

        setDisplayData(filtered);
    }, [searchQuery, dealerSearch, activeFilter, inventoryData]);

    const handleDelete = async (id: string, name: string, batch: string) => {
        if (!window.confirm(`Delete batch ${batch} of ${name}? This action is permanent.`)) return;

        try {
            const { error } = await supabase.from('inventory').delete().eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error("Delete error:", error);
            alert("Failed to delete inventory item.");
        }
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;
        setIsSaving(true);

        try {
            const { error } = await supabase
                .from('inventory')
                .update({
                    quantity: editingItem.quantity,
                    mrp: editingItem.mrp,
                    expiry_date: editingItem.expiry_date
                })
                .eq('id', editingItem.id);

            if (error) throw error;
            setEditingItem(null);
        } catch (error) {
            console.error("Update error:", error);
            alert("Failed to update item.");
        } finally {
            setIsSaving(false);
        }
    };

    const formatExpiryUI = (dateString: string) => {
        const date = new Date(dateString);
        return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
    };

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500 space-y-6 sm:space-y-8 relative pb-10">

            {/* EDIT BATCH MODAL */}
            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-border bg-muted/30 shrink-0">
                            <div>
                                <h3 className="font-bold text-foreground text-lg">Edit Batch</h3>
                                <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px] sm:max-w-xs">{editingItem.medicine_name} (Batch: {editingItem.batch_number})</p>
                            </div>
                            <button onClick={() => setEditingItem(null)} className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg shrink-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto custom-scrollbar">
                            <div className="space-y-1.5">
                                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Quantity</label>
                                <input
                                    type="number" min="0" required
                                    value={editingItem.quantity}
                                    onChange={e => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">M.R.P (₹)</label>
                                <input
                                    type="number" step="0.01" required
                                    value={editingItem.mrp}
                                    onChange={e => setEditingItem({ ...editingItem, mrp: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Expiry Date (MM/YYYY)</label>
                                <input
                                    type="month" required
                                    // Extract just the YYYY-MM part from the database's full date string
                                    value={editingItem.expiry_date ? editingItem.expiry_date.substring(0, 7) : ""}
                                    // Append -01 so it saves properly to the database as a complete valid date
                                    onChange={e => setEditingItem({ ...editingItem, expiry_date: `${e.target.value}-01` })}
                                    className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                                />
                            </div>
                            <div className="pt-2 sm:pt-4 flex flex-col-reverse sm:flex-row gap-3">
                                <button type="button" onClick={() => setEditingItem(null)} className="w-full sm:w-1/2 px-4 py-2.5 rounded-xl font-bold text-muted-foreground bg-secondary hover:bg-muted transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSaving} className="w-full sm:w-1/2 px-4 py-2.5 rounded-xl font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* HEADER & GLOBAL ACTIONS */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 sm:gap-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-1 sm:mb-2">Inventory Overview</h1>
                    <p className="text-muted-foreground text-sm">Monitor real-time stock levels, valuations, and shortages</p>
                </div>

                <div className="relative w-full lg:w-80 shrink-0">
                    <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search medicines or batches..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors shadow-sm"
                    />
                </div>
            </div>

            {/* FILTER PILLS */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {[
                    { label: "All", value: "All" },
                    { label: "Expiring soon", value: "Expiring" },
                    { label: "Out of stock", value: "Out" },
                    { label: "Dead stock", value: "Dead" },
                    { label: "By dealer", value: "Dealer" }
                ].map((filter) => (
                    <button
                        key={filter.value}
                        onClick={() => {
                            setActiveFilter(filter.value as any);
                            if (filter.value !== "Dealer") setDealerSearch("");
                        }}
                        className={`px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeFilter === filter.value
                            ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(110,229,145,0.2)]"
                            : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                            }`}
                    >
                        {filter.label}
                    </button>
                ))}

                {/* DEALER SEARCH INPUT */}
                {activeFilter === "Dealer" && (
                    <input
                        type="text"
                        placeholder="Type dealer name..."
                        autoFocus
                        value={dealerSearch}
                        onChange={(e) => setDealerSearch(e.target.value)}
                        className="w-full sm:w-auto mt-2 sm:mt-0 sm:ml-2 px-4 py-2 bg-background border border-primary/50 rounded-lg text-sm text-foreground focus:outline-none shadow-[0_0_10px_rgba(110,229,145,0.1)] animate-in slide-in-from-top-2 sm:slide-in-from-left-2 duration-300"
                    />
                )}
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-sm">
                    <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-2 sm:mb-3">Total SKUs</p>
                    <p className="text-2xl sm:text-4xl font-bold text-foreground tracking-tight">{kpis.skus}</p>
                </div>
                <div className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-sm">
                    <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-2 sm:mb-3">Expiring ≤90d</p>
                    <p className="text-2xl sm:text-4xl font-bold text-[#F59E0B] tracking-tight">{kpis.expiring}</p>
                </div>
                <div className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-sm">
                    <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-2 sm:mb-3">Out of stock</p>
                    <p className="text-2xl sm:text-4xl font-bold text-destructive/90 tracking-tight">{kpis.out}</p>
                </div>
                <div className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-sm">
                    <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mb-2 sm:mb-3">Dead stock</p>
                    <p className="text-2xl sm:text-4xl font-bold text-muted-foreground tracking-tight">{kpis.dead}</p>
                </div>
            </div>

            {/* MAIN TABLE */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto custom-scrollbar min-h-[400px]">
                    <table className="w-full border-collapse whitespace-nowrap min-w-[900px]">
                        <thead>
                            <tr className="text-xs tracking-wider text-muted-foreground font-mono border-b border-border bg-muted/30">
                                <th className="px-6 py-5 font-bold uppercase text-left">Medicine</th>
                                <th className="px-6 py-5 font-bold uppercase text-left">Category</th>
                                <th className="px-6 py-5 font-bold uppercase text-right">M.R.P</th>
                                <th className="px-6 py-5 font-bold uppercase text-center">Batch No.</th>
                                <th className="px-6 py-5 font-bold uppercase text-right">Qty</th>
                                <th className="px-6 py-5 font-bold uppercase text-center">Exp Date</th>
                                <th className="px-6 py-5 font-bold uppercase text-center">Status</th>
                                <th className="px-6 py-5 font-bold uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-20 text-center text-muted-foreground">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                                        <p>Analyzing inventory...</p>
                                    </td>
                                </tr>
                            ) : displayData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-20 text-center text-muted-foreground">
                                        <PackageSearch className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-lg font-medium text-foreground mb-1">No batches found</p>
                                        <p className="text-sm">Try adjusting your filters or search query.</p>
                                    </td>
                                </tr>
                            ) : (
                                displayData.map((item) => (
                                    <tr key={item.id} className="hover:bg-muted/50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-foreground text-sm text-left max-w-[200px] truncate block">{item.medicine_name}</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground text-left">{item.category}</td>
                                        <td className="px-6 py-4 text-sm text-foreground font-mono text-right">₹{item.mrp.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground font-mono text-center">
                                            <span className="bg-background border border-border px-2.5 py-1 rounded">
                                                {item.batch_number}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-foreground font-mono font-bold text-right">
                                            {item.quantity}
                                            {item.quantity < 10 && item.quantity > 0 && <AlertTriangle className="inline w-3 h-3 text-[#F59E0B] ml-2" />}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground font-mono text-center">
                                            {formatExpiryUI(item.expiry_date)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                {item.status === "OK" && (
                                                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/20">OK</span>
                                                )}
                                                {item.status === "Expiring" && (
                                                    <span className="bg-[#F59E0B]/10 text-[#F59E0B] px-3 py-1 rounded-full text-xs font-bold border border-[#F59E0B]/30">Expiring</span>
                                                )}
                                                {item.status === "Out" && (
                                                    <span className="bg-destructive/10 text-destructive px-3 py-1 rounded-full text-xs font-bold border border-destructive/20">Out</span>
                                                )}
                                                {item.status === "Dead" && (
                                                    <span className="bg-muted-foreground/10 text-muted-foreground px-3 py-1 rounded-full text-xs font-bold border border-muted-foreground/20">Dead</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {/* FIX: Buttons visible on mobile, hidden on hover for desktop */}
                                            <div className="flex justify-end gap-4 sm:gap-3 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setEditingItem(item)}
                                                    className="text-muted-foreground hover:text-foreground transition-colors p-2 sm:p-1 cursor-pointer"
                                                    title="Edit Batch"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id, item.medicine_name, item.batch_number)}
                                                    className="text-destructive/70 hover:text-destructive transition-colors p-2 sm:p-1 cursor-pointer"
                                                    title="Delete Batch"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
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