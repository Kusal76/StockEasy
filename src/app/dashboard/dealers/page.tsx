"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { Users, Search, Plus, Loader2, Edit, Trash2, X, MapPin, Phone, Mail, Building2, Save, AlertTriangle, Lock } from "lucide-react";

interface Dealer {
    id: string;
    name: string;
    contact_person: string;
    phone: string;
    email: string;
    gst_number: string;
    address: string;
    supplied_value?: number;
    expired_value?: number;
}

// --- STRICT DYNAMIC PLAN LIMITS FOR DEMO ---
const PLAN_LIMITS = {
    STARTER: { maxDealers: 2 },
    GROWTH: { maxDealers: 10 },
    PRO: { maxDealers: Infinity }
};

export default function DealersPage() {
    const router = useRouter();
    const [dealers, setDealers] = useState<Dealer[]>([]);
    const [displayDealers, setDisplayDealers] = useState<Dealer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // --- FEATURE GATING STATE ---
    const [shopPlan, setShopPlan] = useState<keyof typeof PLAN_LIMITS>("STARTER");

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [validationError, setValidationError] = useState("");
    const [formData, setFormData] = useState({
        name: "", contact_person: "", phone: "", email: "", gst_number: "", address: ""
    });

    useEffect(() => {
        fetchDealersAndStats();
    }, []);

    // Local Search Filter
    useEffect(() => {
        if (!searchQuery.trim()) {
            setDisplayDealers(dealers);
            return;
        }
        const lowerQuery = searchQuery.toLowerCase();
        const filtered = dealers.filter(d =>
            d.name.toLowerCase().includes(lowerQuery) ||
            (d.contact_person && d.contact_person.toLowerCase().includes(lowerQuery)) ||
            (d.phone && d.phone.includes(lowerQuery))
        );
        setDisplayDealers(filtered);
    }, [searchQuery, dealers]);

    const fetchDealersAndStats = async () => {
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

            // 1. Fetch Dealers
            const { data: dealersData, error: dealersError } = await supabase
                .from('dealers')
                .select('*')
                .eq('shop_id', userData.shop_id)
                .order('name', { ascending: true });

            if (dealersError) throw dealersError;

            // 2. Fetch Inventory to calculate Supplied and Expired values
            const { data: inventoryData, error: invError } = await supabase
                .from('inventory')
                .select('dealer_name, quantity, initial_quantity, mrp, expiry_date')
                .eq('shop_id', userData.shop_id);

            if (invError) throw invError;

            // Create a Hash Map for O(N) performance on large datasets
            const inventoryMap = new Map<string, any[]>();
            if (inventoryData) {
                for (const item of inventoryData) {
                    if (!item.dealer_name) continue;
                    const key = item.dealer_name.toLowerCase();
                    if (!inventoryMap.has(key)) inventoryMap.set(key, []);
                    inventoryMap.get(key)!.push(item);
                }
            }

            // 3. Process the stats
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const processedDealers = (dealersData || []).map(dealer => {
                let supplied = 0;
                let expired = 0;

                const dealerInv = inventoryMap.get(dealer.name.toLowerCase()) || [];

                dealerInv.forEach(item => {
                    const totalValue = (item.initial_quantity || item.quantity) * item.mrp;
                    supplied += totalValue;

                    const expString = item.expiry_date.includes('T') ? item.expiry_date : `${item.expiry_date}T00:00:00`;
                    if (new Date(expString) < today) {
                        expired += (item.quantity * item.mrp);
                    }
                });

                return { ...dealer, supplied_value: supplied, expired_value: expired };
            });

            setDealers(processedDealers);
            setDisplayDealers(processedDealers);
        } catch (error) {
            console.error("Error fetching dealers:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const currentLimits = PLAN_LIMITS[shopPlan];
    const isDealersFull = dealers.length >= currentLimits.maxDealers;

    const openModal = (dealer?: Dealer) => {
        setValidationError("");

        // --- FEATURE GATING RESTRICTION ---
        if (!dealer && isDealersFull) {
            alert(`${shopPlan} Plan Limit Reached: You can only have ${currentLimits.maxDealers} dealers on this plan. Please upgrade to the next tier to add more suppliers.`);
            router.push('/dashboard/settings');
            return;
        }

        if (dealer) {
            setEditingId(dealer.id);
            setFormData({
                name: dealer.name,
                contact_person: dealer.contact_person || "",
                phone: dealer.phone || "",
                email: dealer.email || "",
                gst_number: dealer.gst_number || "",
                address: dealer.address || ""
            });
        } else {
            setEditingId(null);
            setFormData({ name: "", contact_person: "", phone: "", email: "", gst_number: "", address: "" });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError("");

        // 🚨 THE SOFT LOCK: Prevent adding a NEW dealer if limit is reached
        if (!editingId && dealers.length >= currentLimits.maxDealers) {
            return setValidationError(`${shopPlan} Plan Limit Reached: You are only allowed ${currentLimits.maxDealers} dealers. Upgrade to Pro to add more.`);
        }

        if (formData.gst_number.length !== 15) {
            return setValidationError("GST Number must be exactly 15 characters.");
        }
        if (formData.phone.length !== 10) {
            return setValidationError("Phone number must be exactly 10 digits.");
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            return setValidationError("Please enter a valid email address.");
        }

        setIsSaving(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: userData } = await supabase.from('users').select('shop_id').eq('id', user?.id).single();

            if (!userData?.shop_id) throw new Error("Shop context missing");

            const cleanName = formData.name.trim();

            if (editingId) {
                // ... (Leave your existing update logic here)
                const oldDealer = dealers.find(d => d.id === editingId);
                const { error } = await supabase.from('dealers').update({ ...formData, name: cleanName }).eq('id', editingId);
                if (error) throw error;

                if (oldDealer && oldDealer.name !== cleanName) {
                    await supabase.from('inventory').update({ dealer_name: cleanName }).eq('shop_id', userData.shop_id).eq('dealer_name', oldDealer.name);
                }
            } else {
                // 🚨 SECONDARY DATABASE CHECK (Just to be extra safe against race conditions)
                const { count } = await supabase.from('dealers').select('*', { count: 'exact', head: true }).eq('shop_id', userData.shop_id);
                if (count !== null && count >= currentLimits.maxDealers) {
                    throw new Error(`${shopPlan} Plan Limit Reached.`);
                }

                const { error } = await supabase.from('dealers').insert([{ ...formData, name: cleanName, shop_id: userData.shop_id }]);
                if (error) {
                    if (error.code === '23505') throw new Error("A dealer with this name already exists.");
                    throw error;
                }
            }

            await fetchDealersAndStats();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error("Save error:", error);
            setValidationError(error.message || "Failed to save dealer to the database.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete ${name}? This will not delete their associated inventory items.`)) return;

        try {
            const { error } = await supabase.from('dealers').delete().eq('id', id);
            if (error) throw error;
            setDealers(prev => prev.filter(d => d.id !== id));
        } catch (error) {
            console.error("Delete error:", error);
            alert("Failed to delete dealer.");
        }
    };

    const formatCurrency = (amount: number) => {
        if (amount === 0) return "Rs 0";
        if (amount >= 100000) {
            return `Rs ${(amount / 100000).toFixed(1)} L`;
        }
        return `Rs ${amount.toLocaleString('en-IN')}`;
    };

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500 space-y-6 sm:space-y-8 relative pb-10">

            {/* ADD/EDIT MODAL OVERLAY */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">

                        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-border bg-muted/20 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg"><Building2 className="w-5 h-5 text-primary" /></div>
                                <div>
                                    <h3 className="font-bold text-foreground text-base sm:text-lg">{editingId ? 'Edit Dealer Profile' : 'Register New Dealer'}</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Enter the supplier's business and contact details.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {validationError && (
                            <div className="mx-4 sm:mx-6 mt-4 sm:mt-6 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive text-sm font-bold animate-in fade-in">
                                <AlertTriangle className="w-4 h-4 shrink-0" /> {validationError}
                            </div>
                        )}

                        <div className="overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                            <form id="dealer-form" onSubmit={handleSave} className="space-y-4 sm:space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Business / Agency Name *</label>
                                        <input type="text" required value={formData.name} onChange={e => { setFormData({ ...formData, name: e.target.value }); setValidationError(""); }} className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="e.g. Apollo Distributors" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">GST Number *</label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={15}
                                            value={formData.gst_number}
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                                                setFormData({ ...formData, gst_number: val });
                                                setValidationError("");
                                            }}
                                            className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors uppercase"
                                            placeholder="15 Characters"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Contact Person *</label>
                                        <input type="text" required value={formData.contact_person} onChange={e => { setFormData({ ...formData, contact_person: e.target.value }); setValidationError(""); }} className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="e.g. Rajesh Kumar" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Phone Number *</label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={10}
                                            value={formData.phone}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                setFormData({ ...formData, phone: val });
                                                setValidationError("");
                                            }}
                                            className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                                            placeholder="10 Digits"
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Email Address *</label>
                                        <input type="email" required value={formData.email} onChange={e => { setFormData({ ...formData, email: e.target.value }); setValidationError(""); }} className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" placeholder="contact@agency.com" />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Full Business Address *</label>
                                        <textarea required value={formData.address} onChange={e => { setFormData({ ...formData, address: e.target.value }); setValidationError(""); }} rows={3} className="w-full px-4 py-2.5 sm:py-3 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none" placeholder="123 Distributor Lane, Industrial Area..." />
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-4 sm:p-6 border-t border-border bg-card flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button type="submit" form="dealer-form" disabled={isSaving} className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Dealer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header & Global Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-1">Dealers / Suppliers</h1>
                    <p className="text-muted-foreground text-sm">Manage vendor relationships and track expired stock values.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    {/* DYNAMIC LIMIT BADGE */}
                    <div className="flex items-center gap-2 bg-card border border-border px-4 py-2.5 rounded-xl shadow-sm w-full sm:w-auto justify-center shrink-0">
                        <span className="text-xs text-muted-foreground">Plan:</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${shopPlan === 'PRO' ? 'bg-[#EAB308]/10 text-[#EAB308] border-[#EAB308]/30' : 'bg-primary/10 text-primary border-primary/30'}`}>{shopPlan}</span>
                        <div className="text-[11px] font-mono ml-2 flex items-center gap-2">
                            <span className={isDealersFull ? "text-destructive font-bold flex items-center gap-1" : "text-muted-foreground"}>
                                {isDealersFull && <Lock className="w-3 h-3" />}
                                {dealers.length}/{currentLimits.maxDealers === Infinity ? '∞' : currentLimits.maxDealers} Dealers
                            </span>
                        </div>
                    </div>

                    <div className="relative w-full sm:w-64 md:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search directory..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Data Grid / Table */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">

                <div className="p-4 sm:p-6 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-muted rounded-md border border-border"><Building2 className="w-4 h-4 text-foreground" /></div>
                        <h2 className="font-bold text-foreground text-base sm:text-lg">Vendor Directory</h2>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${isDealersFull ? 'bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive hover:text-primary-foreground' : 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-primary-foreground'}`}
                        title={isDealersFull ? "Dealer Limit Reached" : "Add New Dealer"}
                    >
                        {isDealersFull ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Add Dealer
                    </button>
                </div>

                <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                        <thead>
                            <tr className="text-xs tracking-wider text-muted-foreground font-mono border-b border-border bg-muted/20">
                                <th className="px-6 py-5 font-bold uppercase">Dealer</th>
                                <th className="px-6 py-5 font-bold uppercase">Contact</th>
                                <th className="px-6 py-5 font-bold uppercase">GST</th>
                                <th className="px-6 py-5 font-bold uppercase">Supplied</th>
                                <th className="px-6 py-5 font-bold uppercase">Expired Value</th>
                                <th className="px-6 py-5 font-bold uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-32 text-center text-muted-foreground">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                                        <p>Analyzing vendor metrics...</p>
                                    </td>
                                </tr>
                            ) : displayDealers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-32 text-center text-muted-foreground">
                                        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-lg font-medium text-foreground mb-1">{searchQuery ? 'No matching dealers' : 'No dealers registered'}</p>
                                        <p className="text-sm">{searchQuery ? 'Try adjusting your search criteria.' : 'Click "Add Dealer" to build your directory.'}</p>
                                    </td>
                                </tr>
                            ) : (
                                displayDealers.map((dealer) => (
                                    <tr key={dealer.id} className="hover:bg-muted/50 transition-colors group">
                                        <td className="px-6 py-5">
                                            <span className="font-bold text-foreground text-sm">{dealer.name}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-sm text-muted-foreground font-mono">{dealer.phone}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-sm font-mono text-muted-foreground">{dealer.gst_number}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-sm text-foreground font-mono">{formatCurrency(dealer.supplied_value || 0)}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            {dealer.expired_value && dealer.expired_value > 0 ? (
                                                <span className="inline-flex items-center gap-1.5 bg-destructive/10 border border-destructive/30 text-destructive/90 px-3 py-1 rounded text-sm font-bold font-mono">
                                                    <AlertTriangle className="w-3.5 h-3.5" /> {formatCurrency(dealer.expired_value)}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground font-mono">Rs 0</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex justify-end gap-4 sm:gap-3 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openModal(dealer)} className="text-muted-foreground hover:text-foreground transition-all cursor-pointer p-2 sm:p-1" title="Edit Profile">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(dealer.id, dealer.name)} className="text-destructive/70 hover:text-destructive transition-all cursor-pointer p-2 sm:p-1" title="Remove Dealer">
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

                <div className="p-4 bg-background border-t border-border shrink-0">
                    <p className="text-xs text-muted-foreground italic">
                        *Expired Value* shows the worth of each dealer's stock that expired — useful when negotiating returns or terms.
                    </p>
                </div>
            </div>

        </div>
    );
}