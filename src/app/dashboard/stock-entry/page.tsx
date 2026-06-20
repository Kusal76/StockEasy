"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { PackagePlus, Save, Loader2, Pill, Hash, IndianRupee, Percent, TriangleAlert, Plus, Truck } from "lucide-react";

interface CatalogMedicine {
    name: string;
    category: string;
    default_mrp: number | null;
}

// --- Dealer Interface ---
interface Dealer {
    id: string;
    name: string;
}

const CATEGORY_OPTIONS = [
    "Tablet", "Capsule", "Syrup", "Injection", "Drops",
    "Cream", "Ointment", "Inhaler", "Powder", "Surgical", "Other"
];

// --- STRICT DYNAMIC PLAN LIMITS FOR DEMO ---
const PLAN_LIMITS = {
    STARTER: { maxMeds: 5 },
    GROWTH: { maxMeds: 50 },
    PRO: { maxMeds: Infinity }
};

export default function StockEntryPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

    const [catalog, setCatalog] = useState<CatalogMedicine[]>([]);
    const [dealers, setDealers] = useState<Dealer[]>([]);

    // Track Plan
    const [shopPlan, setShopPlan] = useState<keyof typeof PLAN_LIMITS>("STARTER");

    const [isNewMedicine, setIsNewMedicine] = useState(false);

    const [formData, setFormData] = useState({
        medicine_name: "",
        category: "Tablet",
        batch_number: "",
        expiry_date: "",
        quantity: "",
        purchase_price: "",
        mrp: "",
        generic_name: "",
        manufacturer: "",
        dealer_name: ""
    });

    useEffect(() => {
        fetchConnectedData();
    }, []);

    const fetchConnectedData = async () => {
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

            // Fetch Catalog
            const { data: catalogData } = await supabase
                .from('medicines_catalog')
                .select('name, category, default_mrp')
                .eq('shop_id', userData.shop_id)
                .order('name', { ascending: true });

            if (catalogData) setCatalog(catalogData);

            // Fetch Dealers
            const { data: dealersData } = await supabase
                .from('dealers')
                .select('id, name')
                .eq('shop_id', userData.shop_id)
                .order('name', { ascending: true });

            if (dealersData) setDealers(dealersData);

        } catch (error) {
            console.error("Error fetching dependencies:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMedicineSelect = (selectedName: string) => {
        const matchedMed = catalog.find(m => m.name.toLowerCase() === selectedName.toLowerCase());
        if (matchedMed) {
            setIsNewMedicine(false);
            setFormData(prev => ({
                ...prev,
                medicine_name: matchedMed.name,
                category: matchedMed.category || "Tablet",
                mrp: matchedMed.default_mrp ? matchedMed.default_mrp.toString() : prev.mrp,
                generic_name: "",
                manufacturer: ""
            }));
        } else {
            setIsNewMedicine(true);
            setFormData(prev => ({ ...prev, medicine_name: selectedName }));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Double check limits before saving
        const limits = PLAN_LIMITS[shopPlan];

        if (isNewMedicine && catalog.length >= limits.maxMeds) {
            alert(`${shopPlan} Plan Limit Reached: You have reached your maximum of ${limits.maxMeds} catalog items. Please upgrade your plan.`);
            router.push('/dashboard/settings');
            return;
        }

        setIsSaving(true);
        setSuccessMessage("");

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: userData } = await supabase.from('users').select('shop_id').eq('id', user?.id).single();
            if (!userData?.shop_id) throw new Error("Shop context missing");

            const formattedBatch = formData.batch_number.toUpperCase().trim();
            const inputQty = parseInt(formData.quantity);
            const inputMrp = parseFloat(formData.mrp);

            // Format YYYY-MM to YYYY-MM-01 so PostgreSQL accepts it natively
            const dbFormattedExpiry = formData.expiry_date.length === 7
                ? `${formData.expiry_date}-01`
                : formData.expiry_date;

            if (isNewMedicine) {
                const { error: catError } = await supabase.from('medicines_catalog').insert({
                    shop_id: userData.shop_id,
                    name: formData.medicine_name,
                    category: formData.category,
                    default_mrp: inputMrp,
                    generic_name: formData.generic_name || null,
                    manufacturer: formData.manufacturer || null
                });
                if (!catError) {
                    setCatalog(prev => [...prev, { name: formData.medicine_name, category: formData.category, default_mrp: inputMrp }]);
                }
            }

            const { error: insertError } = await supabase
                .from('inventory')
                .insert({
                    shop_id: userData.shop_id,
                    medicine_name: formData.medicine_name,
                    category: formData.category,
                    batch_number: formattedBatch,
                    expiry_date: dbFormattedExpiry,
                    quantity: inputQty,
                    initial_quantity: inputQty,
                    purchase_price: parseFloat(formData.purchase_price),
                    mrp: inputMrp,
                    dealer_name: formData.dealer_name || null
                });

            if (insertError) throw insertError;

            setSuccessMessage(`Successfully recorded inward shipment: ${inputQty} units of ${formData.medicine_name}.`);

            setFormData(prev => ({
                ...prev,
                medicine_name: "",
                batch_number: "",
                quantity: "",
                purchase_price: "",
                mrp: "",
                generic_name: "",
                manufacturer: "",
                dealer_name: ""
            }));
            setIsNewMedicine(false);

            setTimeout(() => setSuccessMessage(""), 5000);
        } catch (error) {
            console.error("Save error:", error);
            alert("Failed to process stock entry. Please verify your inputs.");
        } finally {
            setIsSaving(false);
        }
    };

    const calculateMargin = () => {
        const pp = parseFloat(formData.purchase_price);
        const mrp = parseFloat(formData.mrp);

        if (!isNaN(pp) && !isNaN(mrp) && mrp > 0) {
            const margin = ((mrp - pp) / mrp) * 100;
            return margin.toFixed(1);
        }
        return "0.0";
    };

    const marginValue = calculateMargin();
    const isLoss = parseFloat(marginValue) < 0;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p className="font-medium">Loading database connections...</p>
            </div>
        );
    }

    const currentLimits = PLAN_LIMITS[shopPlan];
    const isMedsFull = catalog.length >= currentLimits.maxMeds;

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in duration-500 space-y-8 relative pb-10">

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                        <PackagePlus className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">Inward Stock Entry</h1>
                        <p className="text-muted-foreground text-sm font-medium">Register new shipments into your live inventory.</p>
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-xl shadow-sm">
                    <span className="text-xs text-muted-foreground font-semibold">Plan:</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${shopPlan === 'PRO' ? 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-primary/10 text-primary border-primary/30'}`}>{shopPlan}</span>
                    <div className="text-[11px] font-mono ml-2 flex items-center gap-2">
                        <span className={isMedsFull ? "text-destructive font-bold" : "text-muted-foreground font-semibold"}>
                            {catalog.length}/{currentLimits.maxMeds === Infinity ? '∞' : currentLimits.maxMeds} SKUs
                        </span>
                    </div>
                </div>
            </div>

            {successMessage && (
                <div className="bg-primary/10 border border-primary/30 p-4 rounded-xl flex items-center gap-3 text-primary font-bold animate-in slide-in-from-top-2 shadow-sm">
                    <Save className="w-5 h-5" /> {successMessage}
                </div>
            )}

            <form onSubmit={handleSave} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-colors">
                <div className="p-8 space-y-8">

                    {/* SECTION 1: Product Identification */}
                    <div>
                        <h2 className="text-xs font-mono text-muted-foreground font-bold uppercase tracking-wider mb-5 flex items-center gap-2 pb-2 border-b border-border">
                            <Pill className="w-4 h-4" /> 1. Product Identification
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold text-foreground">Medicine Name *</label>
                                    {isMedsFull && isNewMedicine && <span className="text-[10px] text-destructive uppercase tracking-wider font-bold">Limit Reached</span>}
                                </div>
                                <input
                                    type="text"
                                    required
                                    list="medicine-catalog-list"
                                    value={formData.medicine_name}
                                    onChange={e => handleMedicineSelect(e.target.value)}
                                    placeholder="e.g. Paracetamol 500mg"
                                    className={`w-full px-4 py-3 bg-secondary hover:bg-muted border ${isMedsFull && isNewMedicine ? 'border-destructive/50 focus:border-destructive text-destructive' : 'border-transparent hover:border-border focus:border-primary'} rounded-xl text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all duration-200 placeholder:text-muted-foreground/40 font-medium shadow-sm`}
                                />
                                <datalist id="medicine-catalog-list">
                                    {catalog.map(med => (
                                        <option key={med.name} value={med.name} />
                                    ))}
                                </datalist>
                                {catalog.length === 0 && <p className="text-xs text-primary/70 font-medium">Type to add to catalog.</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">Category *</label>
                                <select
                                    required
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-4 py-3 bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-xl text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 appearance-none cursor-pointer font-medium shadow-sm"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                        backgroundPosition: `right 1rem center`,
                                        backgroundRepeat: `no-repeat`,
                                        backgroundSize: `1.5em 1.5em`
                                    }}
                                >
                                    {CATEGORY_OPTIONS.map(cat => (
                                        <option key={cat} value={cat} className="bg-card text-foreground">{cat}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Smart Expansion UI */}
                        {isNewMedicine && formData.medicine_name.trim().length > 2 && (
                            <div className={`mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 p-5 border rounded-xl animate-in slide-in-from-top-2 duration-300 shadow-sm ${isMedsFull ? 'bg-destructive/5 border-destructive/30' : 'bg-primary/5 border-primary/20'}`}>
                                <div className="md:col-span-2 flex items-center justify-between">
                                    <p className={`text-sm font-bold flex items-center gap-2 ${isMedsFull ? 'text-destructive' : 'text-primary'}`}>
                                        <span className={`w-2 h-2 rounded-full animate-pulse ${isMedsFull ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-primary shadow-[0_0_8px_rgba(5,150,105,0.6)]'}`}></span>
                                        {isMedsFull ? `Cannot Add New SKU: ${shopPlan} Plan Limit Reached` : "New Medicine Detected. Add catalog details (Optional)"}
                                    </p>
                                    {isMedsFull && (
                                        <button type="button" onClick={() => router.push('/dashboard/settings')} className="text-xs bg-destructive text-destructive-foreground px-3 py-1 rounded font-bold hover:bg-destructive/90 transition-colors">
                                            Upgrade Plan
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground">Generic Name</label>
                                    <input type="text" disabled={isMedsFull} value={formData.generic_name} onChange={e => setFormData({ ...formData, generic_name: e.target.value })} className="w-full px-4 py-3 bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-xl text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 disabled:opacity-50 placeholder:text-muted-foreground/40 font-medium shadow-sm" placeholder="e.g. Amoxicillin Potassium Clavulanate" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-muted-foreground">Manufacturer</label>
                                    <input type="text" disabled={isMedsFull} value={formData.manufacturer} onChange={e => setFormData({ ...formData, manufacturer: e.target.value })} className="w-full px-4 py-3 bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-xl text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 disabled:opacity-50 placeholder:text-muted-foreground/40 font-medium shadow-sm" placeholder="e.g. GlaxoSmithKline" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: Batch Details */}
                    <div>
                        <h2 className="text-xs font-mono text-muted-foreground font-bold uppercase tracking-wider mb-5 flex items-center gap-2 pb-2 border-b border-border">
                            <Hash className="w-4 h-4" /> 2. Batch & Supply Info
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">Batch Number *</label>
                                <input type="text" required value={formData.batch_number} onChange={e => setFormData({ ...formData, batch_number: e.target.value })} className="w-full px-4 py-3 bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-xl text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 uppercase placeholder:text-muted-foreground/40 font-medium shadow-sm" placeholder="e.g. BATCH-A12" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">Expiry Date *</label>
                                <input type="month" required value={formData.expiry_date} onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} className="w-full px-4 py-3 bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-xl text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 font-medium shadow-sm" />
                            </div>

                            {/* Dealer Dropdown */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold text-foreground flex items-center gap-2">Dealer / Supplier</label>
                                </div>
                                <select
                                    value={formData.dealer_name}
                                    onChange={e => setFormData({ ...formData, dealer_name: e.target.value })}
                                    className="w-full px-4 py-3 bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-xl text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 appearance-none cursor-pointer font-medium shadow-sm"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                        backgroundPosition: `right 1rem center`,
                                        backgroundRepeat: `no-repeat`,
                                        backgroundSize: `1.5em 1.5em`
                                    }}
                                >
                                    <option value="" className="text-muted-foreground">Select a Dealer</option>
                                    {dealers.map(dealer => (
                                        <option key={dealer.id} value={dealer.name} className="bg-card text-foreground">
                                            {dealer.name}
                                        </option>
                                    ))}
                                </select>
                                {dealers.length === 0 && <p className="text-[10px] font-semibold text-muted-foreground">No dealers found. Add them in settings.</p>}
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: Commercials */}
                    <div>
                        <h2 className="text-xs font-mono text-muted-foreground font-bold uppercase tracking-wider mb-5 flex items-center gap-2 pb-2 border-b border-border">
                            <IndianRupee className="w-4 h-4" /> 3. Commercials
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">Quantity Received *</label>
                                <input type="number" min="1" required value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} className="w-full px-4 py-3 bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-xl text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 font-mono placeholder:text-muted-foreground/40 shadow-sm" placeholder="Units" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">Purchase Price (₹) *</label>
                                <input type="number" step="0.01" min="0" required value={formData.purchase_price} onChange={e => setFormData({ ...formData, purchase_price: e.target.value })} className="w-full px-4 py-3 bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-xl text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 font-mono placeholder:text-muted-foreground/40 shadow-sm" placeholder="Cost per unit" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">M.R.P (₹) *</label>
                                <input type="number" step="0.01" min="0" required value={formData.mrp} onChange={e => setFormData({ ...formData, mrp: e.target.value })} className="w-full px-4 py-3 bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-xl text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 font-mono placeholder:text-muted-foreground/40 shadow-sm" placeholder="Retail price" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-muted-foreground">Est. Margin</label>
                                <div className={`w-full px-4 py-3 bg-background border ${isLoss ? 'border-destructive/50' : 'border-border'} rounded-xl text-lg font-bold ${isLoss ? 'text-destructive' : 'text-primary'} transition-colors font-mono flex items-center justify-between shadow-sm`}>
                                    <span>{marginValue}%</span>
                                    {isLoss ? <TriangleAlert className="w-5 h-5 text-destructive" /> : <Percent className="w-4 h-4 opacity-50" />}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <div className="p-6 border-t border-border bg-muted/30 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSaving || (isMedsFull && isNewMedicine)}
                        className="px-8 py-3.5 rounded-xl font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:-translate-y-0.5"
                    >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} Commit to Ledger
                    </button>
                </div>
            </form>

        </div>
    );
}