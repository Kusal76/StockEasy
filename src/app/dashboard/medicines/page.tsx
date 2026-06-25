"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { Search, Plus, Loader2, Edit, Trash2, X, Pill, Save, Package, Filter, ChevronDown, AlertTriangle, Lock } from "lucide-react";

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

// --- STRICT DYNAMIC PLAN LIMITS ---
const PLAN_LIMITS = {
    STARTER: { maxMedicines: 5 },
    GROWTH: { maxMedicines: 50 },
    PRO: { maxMedicines: Infinity }
};

// Custom UI Component for the Filter Dropdown
const FilterDropdown = ({
    value,
    options,
    onChange,
    icon: Icon,
    className
}: {
    value: string,
    options: { value: string, label: string }[],
    onChange: (val: string) => void,
    icon?: any,
    className?: string
}) => {
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
                className={className || "w-full bg-card border border-border rounded-xl flex items-center justify-between px-4 py-2.5 shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20 sm:min-w-[180px]"}
            >
                <div className="flex items-center gap-2 pr-4">
                    {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className="text-foreground text-sm font-bold truncate">{selectedLabel}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-full sm:min-w-[180px] bg-card border border-border rounded-xl shadow-lg z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="py-1 max-h-[200px] overflow-y-auto custom-scrollbar">
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

export default function MedicinesCatalogPage() {
    const [medicines, setMedicines] = useState<CatalogMedicine[]>([]);
    const [displayMedicines, setDisplayMedicines] = useState<CatalogMedicine[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- FEATURE GATING STATE ---
    const [shopPlan, setShopPlan] = useState<keyof typeof PLAN_LIMITS>("STARTER");
    const [validationError, setValidationError] = useState("");

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

            // Fetch Plan securely
            const { data: shopData } = await supabase.from('shops').select('plan').eq('id', userData.shop_id).single();
            if (shopData?.plan) {
                const validPlan = ["STARTER", "GROWTH", "PRO"].includes(shopData.plan.toUpperCase())
                    ? shopData.plan.toUpperCase() as keyof typeof PLAN_LIMITS
                    : "STARTER";
                setShopPlan(validPlan);
            }

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

            // 3. Map
            const inventoryMap = new Map<string, any[]>();
            if (inventoryData) {
                for (const batch of inventoryData) {
                    const key = batch.medicine_name.toLowerCase();
                    if (!inventoryMap.has(key)) inventoryMap.set(key, []);
                    inventoryMap.get(key)!.push(batch);
                }
            }

            // 4. Merge
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

    const currentLimits = PLAN_LIMITS[shopPlan];
    const isMedicinesFull = medicines.length >= currentLimits.maxMedicines;

    const openModal = (medicine?: CatalogMedicine) => {
        setValidationError("");

        // --- FEATURE GATING RESTRICTION ---
        if (!medicine && isMedicinesFull) {
            alert(`${shopPlan} Plan Limit Reached: You can only have ${currentLimits.maxMedicines} SKUs in your catalog on this plan. Please upgrade to add more medicines.`);
            return;
        }

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
        setValidationError("");

        // --- THE SOFT LOCK ---
        if (!editingId && isMedicinesFull) {
            return setValidationError(`${shopPlan} Plan Limit Reached. Please upgrade to add more medicines.`);
        }

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
                const oldMed = medicines.find(m => m.id === editingId);

                const { error } = await supabase.from('medicines_catalog').update(payload).eq('id', editingId);
                if (error) throw error;

                if (oldMed && oldMed.name !== newName) {
                    await supabase
                        .from('inventory')
                        .update({ medicine_name: newName })
                        .eq('shop_id', userData.shop_id)
                        .eq('medicine_name', oldMed.name);
                }
            } else {
                // 🚨 SECONDARY DATABASE CHECK (Extra safety against race conditions)
                const { count } = await supabase.from('medicines_catalog').select('*', { count: 'exact', head: true }).eq('shop_id', userData.shop_id);
                if (count !== null && count >= currentLimits.maxMedicines) {
                    throw new Error(`${shopPlan} Plan Limit Reached.`);
                }

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
            setValidationError(error.message || "Failed to save medicine.");
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
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500 space-y-6 sm:space-y-8 relative pb-10">

            {/* ADD/EDIT MODAL OVERLAY */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-background/80 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
                    {/* FIX: Removed overflow-hidden and max-height to let dropdowns escape */}
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl my-auto flex flex-col">

                        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-border bg-muted/20 rounded-t-2xl shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg"><Pill className="w-5 h-5 text-primary" /></div>
                                <div>
                                    <h3 className="font-bold text-foreground text-base sm:text-lg">{editingId ? 'Edit Medicine' : 'Add to Catalog'}</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Define master details for this product.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg cursor-pointer shrink-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {validationError && (
                            <div className="mx-4 sm:mx-6 mt-4 sm:mt-6 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive text-sm font-bold animate-in fade-in">
                                <AlertTriangle className="w-4 h-4 shrink-0" /> {validationError}
                            </div>
                        )}

                        {/* FIX: Removed custom-scrollbar and overflow-y-auto so the dropdown can break out */}
                        <div className="p-4 sm:p-6 pb-20 sm:pb-32">
                            <form id="medicine-form" onSubmit={handleSave} className="space-y-4 sm:space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Brand Name & Strength *</label>
                                        <input type="text" required value={formData.name} onChange={e => { setFormData({ ...formData, name: e.target.value }); setValidationError(""); }} className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="e.g. Calpol 500mg" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Generic Composition / Salt</label>
                                        <input type="text" value={formData.generic_name} onChange={e => { setFormData({ ...formData, generic_name: e.target.value }); setValidationError(""); }} className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="e.g. Paracetamol" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Category *</label>
                                        {/* FIX: Standard downward dropping filter */}
                                        <FilterDropdown
                                            value={formData.category}
                                            onChange={(val) => { setFormData({ ...formData, category: val }); setValidationError(""); }}
                                            options={CATEGORIES.map(cat => ({ value: cat, label: cat }))}
                                            className="w-full bg-background border border-border rounded-xl flex items-center justify-between px-4 py-2.5 sm:py-3 shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Default M.R.P (₹)</label>
                                        <input type="number" step="0.01" value={formData.default_mrp} onChange={e => { setFormData({ ...formData, default_mrp: e.target.value }); setValidationError(""); }} className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="0.00" />
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Manufacturer / Company</label>
                                        <input type="text" value={formData.manufacturer} onChange={e => { setFormData({ ...formData, manufacturer: e.target.value }); setValidationError(""); }} className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="e.g. Cipla, Sun Pharma" />
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-4 sm:p-6 border-t border-border bg-card flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0 rounded-b-2xl">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button type="submit" form="medicine-form" disabled={isSaving} className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Medicine
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header & Global Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-1">Medicines Catalog</h1>
                    <p className="text-muted-foreground text-sm">Central catalog for all medicines handled by your pharmacy.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    {/* DYNAMIC LIMIT BADGE */}
                    <div className="flex items-center gap-2 bg-card border border-border px-4 py-2.5 rounded-xl shadow-sm w-full sm:w-auto justify-center shrink-0">
                        <span className="text-xs text-muted-foreground">Plan:</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${shopPlan === 'PRO' ? 'bg-[#EAB308]/10 text-[#EAB308] border-[#EAB308]/30' : 'bg-primary/10 text-primary border-primary/30'}`}>{shopPlan}</span>
                        <div className="text-[11px] font-mono ml-2 flex items-center gap-2">
                            <span className={isMedicinesFull ? "text-destructive font-bold flex items-center gap-1" : "text-muted-foreground"}>
                                {isMedicinesFull && <Lock className="w-3 h-3" />}
                                {medicines.length}/{currentLimits.maxMedicines === Infinity ? '∞' : currentLimits.maxMedicines} SKUs
                            </span>
                        </div>
                    </div>

                    {/* CUSTOM FILTER DROPDOWN */}
                    <FilterDropdown
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        icon={Filter}
                        options={[
                            { value: "All", label: "All Categories" },
                            ...CATEGORIES.map(cat => ({ value: cat, label: cat }))
                        ]}
                    />

                    {/* Search */}
                    <div className="relative w-full sm:w-64 md:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by brand, generic, or maker..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Data Grid / Table */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">

                <div className="p-4 sm:p-6 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-muted rounded-md border border-border"><Package className="w-4 h-4 text-foreground" /></div>
                        <h2 className="font-bold text-foreground text-base sm:text-lg">Medicine Master List</h2>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${isMedicinesFull ? 'bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive hover:text-primary-foreground' : 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-primary-foreground'}`}
                        title={isMedicinesFull ? "Catalog Limit Reached" : "Add New Medicine"}
                    >
                        {isMedicinesFull ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Add Medicine
                    </button>
                </div>

                {/* HORIZONTAL SCROLL WRAPPER */}
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[900px]">
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
                                            <span className="font-bold text-foreground text-sm max-w-[200px] truncate block">{med.name}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-muted-foreground max-w-[200px] truncate block">{med.generic_name || "--"}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-background border border-border px-2 py-0.5 rounded text-xs font-bold text-muted-foreground whitespace-nowrap">
                                                {med.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-muted-foreground max-w-[150px] truncate block">{med.manufacturer || "--"}</span>
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
                                            <div className="flex justify-end gap-4 sm:gap-3 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openModal(med)} className="text-muted-foreground hover:text-foreground transition-all cursor-pointer p-1" title="Edit Medicine">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(med.id, med.name)} className="text-destructive/70 hover:text-destructive transition-all cursor-pointer p-1" title="Delete Medicine">
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