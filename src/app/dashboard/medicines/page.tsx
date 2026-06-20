"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Search, Plus, Loader2, Edit, Trash2, X, Pill, Save, Package, Filter } from "lucide-react";

interface CatalogMedicine {
    id: string;
    name: string;
    generic_name?: string;
    category: string;
    manufacturer: string;
    default_mrp: number;
    total_qty?: number;
    nearest_expiry?: string;
}

export default function MedicinesCatalogPage() {
    const [medicines, setMedicines] = useState<CatalogMedicine[]>([]);
    const [displayMedicines, setDisplayMedicines] = useState<CatalogMedicine[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "", generic_name: "", category: "Tablet", manufacturer: "", default_mrp: ""
    });

    const CATEGORIES = ["Tablet", "Capsule", "Syrup", "Injection", "Ointment", "Drops", "Inhaler", "Other"];

    useEffect(() => {
        fetchCatalogAndInventory();
    }, []);

    // Local Search & Category Filter
    useEffect(() => {
        let filtered = medicines;

        if (categoryFilter !== "All") {
            filtered = filtered.filter(m => m.category === categoryFilter);
        }

        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(m =>
                m.name.toLowerCase().includes(lowerQuery) ||
                (m.generic_name && m.generic_name.toLowerCase().includes(lowerQuery)) ||
                (m.manufacturer && m.manufacturer.toLowerCase().includes(lowerQuery))
            );
        }

        setDisplayMedicines(filtered);
    }, [searchQuery, categoryFilter, medicines]);

    const fetchCatalogAndInventory = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: userData } = await supabase.from('users').select('shop_id').eq('id', user.id).single();
            if (!userData?.shop_id) return;

            // 1. Fetch Catalog
            const { data: catalogData, error: catalogError } = await supabase
                .from('medicines_catalog')
                .select('*')
                .eq('shop_id', userData.shop_id)
                .order('name', { ascending: true });

            if (catalogError) throw catalogError;

            // 2. Fetch Live Inventory
            const { data: inventoryData, error: invError } = await supabase
                .from('inventory')
                .select('medicine_name, quantity, expiry_date')
                .eq('shop_id', userData.shop_id)
                .gt('quantity', 0);

            if (invError) throw invError;

            // FIX 1: O(N) Hash Map for massive performance gains on large databases
            const inventoryMap = new Map<string, any[]>();
            if (inventoryData) {
                for (const batch of inventoryData) {
                    const key = batch.medicine_name.toLowerCase();
                    if (!inventoryMap.has(key)) inventoryMap.set(key, []);
                    inventoryMap.get(key)!.push(batch);
                }
            }

            // 3. Merge Live Data into Catalog using the optimized Hash Map
            const processedCatalog = (catalogData || []).map(med => {
                let totalQty = 0;
                let nearestExp: Date | null = null;

                const batches = inventoryMap.get(med.name.toLowerCase()) || [];

                for (const batch of batches) {
                    totalQty += batch.quantity;
                    const expDate = new Date(batch.expiry_date);
                    if (!nearestExp || expDate < nearestExp) {
                        nearestExp = expDate;
                    }
                }

                return {
                    ...med,
                    total_qty: totalQty,
                    nearest_expiry: nearestExp ? (nearestExp as Date).toISOString() : undefined
                };
            });

            setMedicines(processedCatalog);
            setDisplayMedicines(processedCatalog);
        } catch (error) {
            console.error("Error fetching catalog:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const openModal = (medicine?: CatalogMedicine) => {
        if (medicine) {
            setEditingId(medicine.id);
            setFormData({
                name: medicine.name,
                generic_name: medicine.generic_name || "",
                category: medicine.category,
                manufacturer: medicine.manufacturer || "",
                default_mrp: medicine.default_mrp ? medicine.default_mrp.toString() : ""
            });
        } else {
            setEditingId(null);
            setFormData({ name: "", generic_name: "", category: "Tablet", manufacturer: "", default_mrp: "" });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: userData } = await supabase.from('users').select('shop_id').eq('id', user?.id).single();
            if (!userData?.shop_id) throw new Error("Shop context missing");

            const newName = formData.name.trim();

            const payload = {
                shop_id: userData.shop_id,
                name: newName,
                generic_name: formData.generic_name.trim() || null,
                category: formData.category,
                manufacturer: formData.manufacturer.trim(),
                default_mrp: formData.default_mrp ? parseFloat(formData.default_mrp) : null
            };

            if (editingId) {
                // FIX 2: Cascading Update to prevent Data Corruption
                const oldMed = medicines.find(m => m.id === editingId);

                const { error } = await supabase.from('medicines_catalog').update(payload).eq('id', editingId);
                if (error) throw error;

                // If the name changed, we MUST update the inventory table so the batches don't get orphaned
                if (oldMed && oldMed.name !== newName) {
                    await supabase
                        .from('inventory')
                        .update({ medicine_name: newName })
                        .eq('shop_id', userData.shop_id)
                        .eq('medicine_name', oldMed.name);
                }

            } else {
                const { error } = await supabase.from('medicines_catalog').insert([payload]);
                if (error) {
                    if (error.code === '23505') throw new Error("A medicine with this exact name already exists.");
                    throw error;
                }
            }

            await fetchCatalogAndInventory();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error("Save error:", error);
            alert(error.message || "Failed to save medicine.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Delete ${name} from your catalog? Existing inventory will not be affected.`)) return;

        try {
            const { error } = await supabase.from('medicines_catalog').delete().eq('id', id);
            if (error) throw error;
            setMedicines(prev => prev.filter(m => m.id !== id));
        } catch (error) {
            console.error("Delete error:", error);
            alert("Failed to delete medicine.");
        }
    };

    const formatExpiryUI = (dateString?: string) => {
        if (!dateString) return "--";
        const date = new Date(dateString);
        return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
    };

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500 space-y-8 relative">

            {/* ADD/EDIT MODAL OVERLAY */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4 animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                        <div className="flex justify-between items-center p-6 border-b border-border bg-muted/20 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg"><Pill className="w-5 h-5 text-primary" /></div>
                                <div>
                                    <h3 className="font-bold text-foreground text-lg">{editingId ? 'Edit Medicine' : 'Add to Catalog'}</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Define master details for this product.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 custom-scrollbar">
                            <form id="medicine-form" onSubmit={handleSave} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Brand Name & Strength *</label>
                                        <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="e.g. Calpol 500mg" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Generic Composition / Salt</label>
                                        <input type="text" value={formData.generic_name} onChange={e => setFormData({ ...formData, generic_name: e.target.value })} className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="e.g. Paracetamol" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Category *</label>
                                        <select required value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer">
                                            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Default M.R.P (₹)</label>
                                        <input type="number" step="0.01" value={formData.default_mrp} onChange={e => setFormData({ ...formData, default_mrp: e.target.value })} className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="0.00" />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Manufacturer / Company</label>
                                        <input type="text" value={formData.manufacturer} onChange={e => setFormData({ ...formData, manufacturer: e.target.value })} className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="e.g. Cipla, Sun Pharma" />
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-border bg-card flex justify-end gap-3 shrink-0">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button type="submit" form="medicine-form" disabled={isSaving} className="px-6 py-2.5 rounded-xl font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Medicine
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header & Global Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">Medicines Catalog</h1>
                    <p className="text-muted-foreground text-sm">Central catalog for all medicines handled by your pharmacy.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">

                    {/* Category Filter */}
                    <div className="relative bg-card border border-border rounded-xl flex items-center px-4 py-2.5 shadow-lg w-full sm:w-auto">
                        <Filter className="w-4 h-4 text-muted-foreground mr-2" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-transparent text-foreground text-sm font-bold focus:outline-none cursor-pointer appearance-none pr-6 w-full"
                        >
                            <option className="bg-card" value="All">All Categories</option>
                            {CATEGORIES.map(cat => <option className="bg-card" key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by brand, generic, or maker..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors shadow-lg"
                        />
                    </div>
                </div>
            </div>

            {/* Data Grid / Table */}
            <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[500px]">

                <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-muted rounded-md border border-border"><Package className="w-4 h-4 text-foreground" /></div>
                        <h2 className="font-bold text-foreground text-lg">Medicine Master List</h2>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center justify-center gap-2 bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-lg font-bold hover:bg-primary hover:text-primary-foreground transition-all whitespace-nowrap cursor-pointer"
                    >
                        <Plus className="w-4 h-4" /> Add Medicine
                    </button>
                </div>

                <div className="overflow-x-auto flex-1">
                    {/* SCROLL FIX: Removed whitespace-nowrap from table class */}
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs tracking-wider text-muted-foreground font-mono border-b border-border bg-muted/20">
                                <th className="px-6 py-5 font-bold uppercase">Name</th>
                                <th className="px-6 py-5 font-bold uppercase">Generic</th>
                                <th className="px-6 py-5 font-bold uppercase">Category</th>
                                <th className="px-6 py-5 font-bold uppercase">Manufacturer</th>
                                <th className="px-6 py-5 font-bold uppercase text-right">Default MRP</th>
                                <th className="px-6 py-5 font-bold uppercase text-center bg-primary/5">Total Qty</th>
                                <th className="px-6 py-5 font-bold uppercase text-center bg-primary/5">Nearest Exp</th>
                                <th className="px-6 py-5 font-bold uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-32 text-center text-muted-foreground">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                                        <p>Loading catalog & live inventory...</p>
                                    </td>
                                </tr>
                            ) : displayMedicines.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-32 text-center text-muted-foreground">
                                        <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-lg font-medium text-foreground mb-1">{searchQuery || categoryFilter !== "All" ? 'No matching medicines' : 'Catalog is empty'}</p>
                                        <p className="text-sm">{searchQuery || categoryFilter !== "All" ? 'Try adjusting your filters.' : 'Click "Add Medicine" to start building your catalog.'}</p>
                                    </td>
                                </tr>
                            ) : (
                                displayMedicines.map((med) => (
                                    <tr key={med.id} className="hover:bg-muted/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-foreground text-sm">{med.name}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-muted-foreground">{med.generic_name || "--"}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-background border border-border px-2 py-0.5 rounded text-xs font-bold text-muted-foreground whitespace-nowrap">
                                                {med.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-muted-foreground">{med.manufacturer || "--"}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm text-foreground font-mono whitespace-nowrap">
                                                {med.default_mrp ? `₹${med.default_mrp.toFixed(2)}` : "--"}
                                            </span>
                                        </td>
                                        {/* Live Inventory Columns */}
                                        <td className="px-6 py-4 text-center bg-muted/10">
                                            <span className={`text-sm font-bold font-mono ${med.total_qty && med.total_qty > 0 ? 'text-foreground' : 'text-destructive'}`}>
                                                {med.total_qty || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center bg-muted/10">
                                            {med.total_qty && med.total_qty > 0 ? (
                                                <span className="text-sm text-muted-foreground font-mono whitespace-nowrap">{formatExpiryUI(med.nearest_expiry)}</span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground/50">--</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openModal(med)} className="text-muted-foreground hover:text-foreground transition-all cursor-pointer" title="Edit Medicine">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(med.id, med.name)} className="text-destructive/70 hover:text-destructive transition-all cursor-pointer" title="Delete Medicine">
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