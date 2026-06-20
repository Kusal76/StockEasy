"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Search, ShoppingCart, Plus, Minus, Trash2, Receipt, CheckCircle2, AlertCircle, Loader2, Printer, UserCircle, AlertTriangle, Percent } from "lucide-react";

interface InventoryItem {
    id: string;
    medicine_name: string;
    generic_name?: string;
    batch_number: string;
    quantity: number;
    mrp: number;
    expiry_date: string;
}

interface CartItem extends InventoryItem {
    cartQuantity: number;
}

export default function SellPage() {
    const [shopId, setShopId] = useState<string | null>(null);
    const [shopName, setShopName] = useState<string>("PHARMACY STORE");
    const [shopPhone, setShopPhone] = useState<string>("Not Provided");
    const [shopAddress, setShopAddress] = useState<string>("");
    const [licenceNumber, setLicenceNumber] = useState<string>("Not Provided");
    const [gstNumber, setGstNumber] = useState<string>("Not Registered");

    const [searchQuery, setSearchQuery] = useState("");
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [fefoRecommendedIds, setFefoRecommendedIds] = useState<Set<string>>(new Set());

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [doctorName, setDoctorName] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Cash");

    const [discountPercentage, setDiscountPercentage] = useState<number | "">("");

    const [isFetchingCustomer, setIsFetchingCustomer] = useState(false);
    const [checkoutError, setCheckoutError] = useState("");
    const [lastBillId, setLastBillId] = useState<string | null>(null);

    useEffect(() => {
        const getShopContext = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();

                if (userData?.shop_id) {
                    setShopId(userData.shop_id);
                    const phoneVal = userData.contact_number || userData.phone;
                    if (phoneVal) setShopPhone(phoneVal);

                    const { data: shopData } = await supabase.from('shops').select('*').eq('id', userData.shop_id).single();

                    if (shopData) {
                        if (shopData.name) setShopName(shopData.name);
                        if (shopData.address) setShopAddress(shopData.address);
                        if (shopData.license_number) setLicenceNumber(shopData.license_number);
                        if (shopData.gst_number || shopData.gstin) setGstNumber(shopData.gst_number || shopData.gstin);
                    }
                }
            } catch (err) {
                console.error("Error loading shop context:", err);
            }
        };
        getShopContext();
    }, []);

    useEffect(() => {
        const searchInventory = async () => {
            const cleanQuery = searchQuery.trim();
            if (cleanQuery.length < 2 || !shopId) {
                setInventory([]);
                setFefoRecommendedIds(new Set());
                return;
            }

            setIsSearching(true);
            try {
                const { data, error } = await supabase
                    .from('inventory')
                    .select('id, medicine_name, generic_name, batch_number, quantity, mrp, expiry_date')
                    .eq('shop_id', shopId)
                    .or(`medicine_name.ilike.%${cleanQuery}%,generic_name.ilike.%${cleanQuery}%`)
                    .gt('quantity', 0)
                    .order('expiry_date', { ascending: true })
                    .limit(20);

                if (error) throw error;

                const results = data || [];
                const recommended = new Set<string>();
                const seenCompositions = new Set<string>();

                results.forEach(item => {
                    const groupKey = item.generic_name ? item.generic_name.toLowerCase().trim() : item.medicine_name.toLowerCase().trim();
                    if (!seenCompositions.has(groupKey)) {
                        recommended.add(item.id);
                        seenCompositions.add(groupKey);
                    }
                });

                results.sort((a, b) => {
                    const aRec = recommended.has(a.id);
                    const bRec = recommended.has(b.id);
                    if (aRec && !bRec) return -1;
                    if (!aRec && bRec) return 1;
                    return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
                });

                setFefoRecommendedIds(recommended);
                setInventory(results);

            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(() => searchInventory(), 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, shopId]);

    useEffect(() => {
        const fetchCustomerDetails = async () => {
            if (customerPhone.length === 10 && shopId && !customerName) {
                setIsFetchingCustomer(true);
                try {
                    const { data } = await supabase
                        .from('bills')
                        .select('customer_name')
                        .eq('shop_id', shopId)
                        .eq('customer_phone', customerPhone)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (data && data.customer_name) setCustomerName(data.customer_name);
                } catch (error) {
                    // Silently fail if new
                } finally {
                    setIsFetchingCustomer(false);
                }
            }
        };
        fetchCustomerDetails();
    }, [customerPhone, shopId, customerName]);

    const addToCart = (item: InventoryItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                if (existing.cartQuantity >= item.quantity) {
                    setCheckoutError("Cannot exceed available stock!");
                    setTimeout(() => setCheckoutError(""), 3000);
                    return prev;
                }
                return prev.map(i => i.id === item.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i);
            }
            return [...prev, { ...item, cartQuantity: 1 }];
        });
        setSearchQuery("");
        setCheckoutError("");
        setLastBillId(null);
    };

    const updateCartQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = item.cartQuantity + delta;
                if (newQty > 0 && newQty <= item.quantity) {
                    return { ...item, cartQuantity: newQty };
                }
            }
            return item;
        }));
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    // --- CART MATH WITH ROUNDING ---
    const cartSubTotal = cart.reduce((sum, item) => sum + (item.mrp * item.cartQuantity), 0);
    const discountVal = Number(discountPercentage) || 0;
    const discountAmount = (cartSubTotal * discountVal) / 100;
    const rawTotal = cartSubTotal - discountAmount;

    // Round to the nearest whole number (e.g. 43.20 -> 43.00)
    const cartGrandTotal = Math.round(rawTotal);
    // Calculate the difference for accounting purposes (e.g. 43.00 - 43.20 = -0.20)
    const roundOffAmount = cartGrandTotal - rawTotal;

    const generatePrintableInvoice = (billId: string, subTotal: number, discountPct: number, discountAmt: number, roundOff: number, grandTotal: number, items: CartItem[]) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const dateStr = new Date().toLocaleDateString('en-IN');
        const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const logoUrl = `${window.location.origin}/Receipt_logo.png`;

        let itemsHtml = items.map(item => `
            <tr>
                <td style="text-align: center;">${item.cartQuantity}</td>
                <td>${item.medicine_name}</td>
                <td style="text-align: center;">${item.batch_number}</td>
                <td style="text-align: center;">${item.expiry_date}</td>
                <td style="text-align: right;">${(item.mrp * item.cartQuantity).toFixed(2)}</td>
            </tr>
        `).join('');

        for (let i = items.length; i < 5; i++) {
            itemsHtml += `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>Cash Memo #${billId.substring(0, 8).toUpperCase()}</title>
                <style>
                    @page { margin: 15mm; }
                    body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 0; color: #000; max-width: 800px; margin: 0 auto; font-size: 13px; line-height: 1.4; }
                    .top-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; font-weight: bold; font-size: 11px; }
                    .cash-memo-badge { background-color: #000; color: #fff; padding: 4px 10px; font-size: 14px; margin-top: 5px; display: inline-block; }
                    .header { text-align: center; margin-bottom: 10px; }
                    .header h1 { margin: 0; font-size: 26px; text-transform: uppercase; letter-spacing: 1px; color: #000; }
                    .header h3 { margin: 4px 0; font-size: 14px; letter-spacing: 2px; }
                    .header p { margin: 2px 0; font-size: 11px; }
                    .divider { border-top: 2px solid #000; margin: 5px 0; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 2px solid #000; }
                    .info-grid > div { padding: 5px; }
                    .info-grid > div:first-child { border-right: 2px solid #000; }
                    table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 0; }
                    th { border: 1px solid #000; border-bottom: 2px solid #000; padding: 6px; text-align: center; font-size: 12px; font-weight: bold; }
                    td { border: 1px solid #000; padding: 6px; }
                    .total-row { display: flex; justify-content: space-between; align-items: center; border: 2px solid #000; border-top: none; font-weight: bold; font-size: 14px; }
                    .total-label { flex: 1; padding: 5px; text-align: right; border-right: 2px solid #000; }
                    .total-value { width: 100px; padding: 5px; text-align: right; }
                    .bottom-grid { display: grid; grid-template-columns: 2fr 1fr; align-items: end; margin-top: 5px; }
                    .terms { font-size: 10px; padding: 5px; }
                    .signature { text-align: center; padding: 5px; font-weight: bold; font-size: 12px; }
                    .signature-space { height: 40px; }
                    .watermark-container { text-align: center; margin-top: 40px; padding-top: 15px; border-top: 1px dashed #ccc; }
                    .watermark { font-size: 13px; color: #555; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 10px; }
                    .watermark img { height: 24px; object-fit: contain; } 
                </style>
            </head>
            <body>
                <div class="top-bar">
                    <div>
                        Drug Lic No.:<br>
                        ${licenceNumber.split(',').join('<br>')}
                    </div>
                    <div style="text-align: right;">
                        GSTIN: ${gstNumber}<br>
                        <div class="cash-memo-badge">CASH MEMO</div>
                    </div>
                </div>

                <div class="header">
                    <h1>${shopName}</h1>
                    <p>${shopAddress ? `${shopAddress} | ` : ''}Ph: ${shopPhone}</p>
                </div>

                <div class="divider"></div>

                <div class="info-grid">
                    <div>
                        <strong>Name :</strong> ${customerName}<br>
                        <strong>Dr. &nbsp;&nbsp;&nbsp;&nbsp;:</strong> ${doctorName || ''}
                    </div>
                    <div>
                        <strong>Invoice No:</strong> ${billId.substring(0, 8).toUpperCase()}<br>
                        <strong>Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</strong> ${dateStr} &nbsp; ${timeStr}
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">Qty.</th>
                            <th>PARTICULARS</th>
                            <th style="width: 100px;">Batch</th>
                            <th style="width: 80px;">Exp.</th>
                            <th style="width: 100px;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div class="total-row">
                    <div class="total-label">SUBTOTAL</div>
                    <div class="total-value">${subTotal.toFixed(2)}</div>
                </div>
                ${discountPct > 0 ? `
                <div class="total-row" style="border-top: none;">
                    <div class="total-label">DISCOUNT (${discountPct}%)</div>
                    <div class="total-value">-${discountAmt.toFixed(2)}</div>
                </div>
                ` : ''}
                ${roundOff !== 0 ? `
                <div class="total-row" style="border-top: none;">
                    <div class="total-label">ROUND OFF</div>
                    <div class="total-value">${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}</div>
                </div>
                ` : ''}
                <div class="total-row" style="border-top: none; background-color: #f8fafc;">
                    <div class="total-label">GRAND TOTAL</div>
                    <div class="total-value">${grandTotal.toFixed(2)}</div>
                </div>

                <div class="bottom-grid">
                    <div class="terms">
                        All disputes subject to local Jurisdiction only.<br>
                        Medicines without Batch No. & Exp. will not be taken back.<br>
                        Please consult Dr. before using the medicines. E. & O.E.
                    </div>
                    <div class="signature">
                        For: ${shopName}<br>
                        <div class="signature-space"></div>
                        Authorised Signatory
                    </div>
                </div>

                <div class="watermark-container">
                    <div class="watermark">
                        <span>Generated securely via</span>
                        <img src="${logoUrl}" alt="StockEasy" />
                    </div>
                </div>

                <script>
                    window.onload = function() { 
                        setTimeout(() => { window.print(); }, 250);
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleCheckout = async () => {
        if (cart.length === 0 || !shopId) return;

        setCheckoutError("");

        if (!customerName.trim()) return setCheckoutError("Customer name is required.");
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(customerPhone)) return setCheckoutError("Phone number must be exactly 10 digits.");

        setIsCheckingOut(true);

        try {
            const { data: billData, error: billError } = await supabase
                .from('bills')
                .insert({
                    shop_id: shopId,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    subtotal: cartSubTotal,
                    discount_percentage: discountVal,
                    total_amount: cartGrandTotal, // DB natively receives the rounded exact value!
                    payment_method: paymentMethod
                })
                .select('id')
                .single();

            if (billError) throw billError;

            const billItemsToInsert = cart.map(item => ({
                bill_id: billData.id,
                inventory_id: item.id,
                medicine_name: item.medicine_name,
                batch_number: item.batch_number,
                expiry_date: item.expiry_date,
                quantity: item.cartQuantity,
                unit_price: item.mrp,
                total_price: item.mrp * item.cartQuantity
            }));

            const { error: itemsError } = await supabase.from('bill_items').insert(billItemsToInsert);
            if (itemsError) throw itemsError;

            for (const item of cart) {
                const newStock = item.quantity - item.cartQuantity;
                await supabase.from('inventory').update({ quantity: newStock }).eq('id', item.id);
            }

            generatePrintableInvoice(billData.id, cartSubTotal, discountVal, discountAmount, roundOffAmount, cartGrandTotal, cart);

            setLastBillId(billData.id);
            setCart([]);
            setCustomerName("");
            setCustomerPhone("");
            setDoctorName("");
            setDiscountPercentage("");

        } catch (error: any) {
            console.error("Checkout Error:", error);
            setCheckoutError(error.message || "Failed to process checkout.");
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="h-full flex gap-6 animate-in fade-in duration-500 relative">

            <div className="flex-1 flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Point of Sale</h1>
                    <p className="text-muted-foreground text-sm font-medium mt-1">Search inventory and create new bills.</p>
                </div>

                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search medicines by brand or composition..."
                        className="w-full bg-secondary hover:bg-muted border border-transparent hover:border-border text-foreground text-lg rounded-2xl pl-12 pr-4 py-4 focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 placeholder:text-muted-foreground shadow-sm"
                    />
                    {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-spin" />}
                </div>

                <div className="flex-1 bg-card border border-border rounded-2xl p-4 overflow-y-auto custom-scrollbar shadow-sm">
                    {searchQuery.length < 2 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                            <Search className="w-12 h-12 mb-4" />
                            <p className="font-medium">Type at least 2 characters to search inventory</p>
                        </div>
                    ) : inventory.length === 0 && !isSearching ? (
                        <div className="h-full flex flex-col items-center justify-center text-warning opacity-80">
                            <AlertCircle className="w-12 h-12 mb-4" />
                            <p className="font-medium">No medicines found in stock.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {inventory.map((item) => {
                                const isRecommended = fefoRecommendedIds.has(item.id);

                                return (
                                    <div
                                        key={item.id}
                                        className={`flex items-center justify-between p-4 bg-background border ${isRecommended ? 'border-amber-500 ring-1 ring-amber-500/20 shadow-md' : 'border-border hover:border-border/80 hover:shadow-sm'} rounded-xl transition-all duration-200`}
                                    >
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-bold text-foreground text-lg">{item.medicine_name}</h3>
                                                {isRecommended && (
                                                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
                                                        <AlertTriangle className="w-3 h-3" /> Sell First
                                                    </span>
                                                )}
                                            </div>

                                            {item.generic_name && (
                                                <p className="text-[11px] font-medium text-muted-foreground mt-0.5 max-w-sm truncate">
                                                    {item.generic_name}
                                                </p>
                                            )}

                                            <div className="flex gap-4 text-xs font-mono text-muted-foreground mt-2">
                                                <span>Batch: <span className="text-foreground font-semibold">{item.batch_number}</span></span>
                                                <span>Stock: <span className="text-foreground font-semibold">{item.quantity}</span></span>
                                                <span>Exp: <span className={isRecommended ? "text-amber-500 font-bold" : "text-foreground font-semibold"}>{item.expiry_date}</span></span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-bold text-primary text-xl tracking-tight">₹{item.mrp.toFixed(2)}</span>
                                            <button
                                                onClick={() => addToCart(item)}
                                                className={`p-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center ${isRecommended
                                                    ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-md hover:shadow-lg hover:-translate-y-0.5'
                                                    : 'bg-secondary text-primary border border-border hover:bg-muted hover:border-primary/50'
                                                    }`}
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT SIDE: CART & CHECKOUT */}
            <div className="w-[400px] flex flex-col bg-card border border-border rounded-2xl shadow-md overflow-hidden">
                <div className="p-5 border-b border-border bg-muted/30 flex items-center gap-3">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                    <h2 className="font-bold text-foreground text-lg">Current Bill</h2>
                    <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">{cart.length} Items</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-card">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                            {lastBillId ? (
                                <>
                                    <CheckCircle2 className="w-12 h-12 mb-4 text-primary" />
                                    <p className="text-primary font-bold">Transaction Successful</p>
                                    <p className="text-xs mt-1 font-medium">Bill generated and printing.</p>
                                </>
                            ) : (
                                <>
                                    <ShoppingCart className="w-12 h-12 mb-4" />
                                    <p className="font-medium">Cart is empty</p>
                                </>
                            )}
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="p-3.5 bg-background border border-border hover:border-border/80 hover:shadow-sm rounded-xl relative group transition-all duration-200">
                                <h4 className="font-bold text-sm text-foreground mb-1.5 pr-6">{item.medicine_name}</h4>
                                <div className="flex justify-between items-end">
                                    <span className="text-xs text-muted-foreground font-mono leading-relaxed">
                                        ₹{item.mrp} x {item.cartQuantity} <br />
                                        <span className="bg-muted px-1.5 py-0.5 rounded inline-block mt-1 border border-border/50">Batch: {item.batch_number}</span>
                                    </span>
                                    <span className="font-bold text-primary text-base">₹{(item.mrp * item.cartQuantity).toFixed(2)}</span>
                                </div>

                                <div className="flex items-center gap-2 mt-3">
                                    <button onClick={() => updateCartQuantity(item.id, -1)} className="p-1.5 bg-secondary border border-border rounded-md hover:bg-muted hover:text-foreground text-muted-foreground transition-colors cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
                                    <span className="text-sm font-bold w-6 text-center text-foreground">{item.cartQuantity}</span>
                                    <button onClick={() => updateCartQuantity(item.id, 1)} className="p-1.5 bg-secondary border border-border rounded-md hover:bg-muted hover:text-foreground text-muted-foreground transition-colors cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
                                </div>

                                <button onClick={() => removeFromCart(item.id)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors cursor-pointer">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-5 bg-background border-t border-border space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="text"
                            placeholder="Customer Name *"
                            value={customerName}
                            onChange={e => { setCustomerName(e.target.value); setCheckoutError(""); }}
                            className="w-full px-3.5 py-2.5 bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-lg text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 placeholder:text-muted-foreground font-medium"
                        />
                        <div className="relative w-full">
                            <input
                                type="text"
                                maxLength={10}
                                placeholder="10-Digit Phone *"
                                value={customerPhone}
                                onChange={e => { setCustomerPhone(e.target.value.replace(/\D/g, '')); setCheckoutError(""); }}
                                className="w-full px-3.5 py-2.5 bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-lg text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 placeholder:text-muted-foreground font-medium"
                            />
                            {isFetchingCustomer && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />}
                        </div>
                    </div>

                    <div className="relative group">
                        <UserCircle className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Prescribing Doctor (Optional)"
                            value={doctorName}
                            onChange={e => setDoctorName(e.target.value)}
                            className="w-full pl-10 pr-3.5 py-2.5 bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-lg text-sm text-foreground focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 placeholder:text-muted-foreground font-medium"
                        />
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-border">
                        <span className="text-muted-foreground text-sm font-semibold">Payment Method</span>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-md px-2 py-1 text-foreground text-sm font-bold focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200 cursor-pointer">
                            <option value="Cash">Cash</option>
                            <option value="Card">Card</option>
                            <option value="UPI">UPI</option>
                        </select>
                    </div>

                    {/* --- DISCOUNT INPUT --- */}
                    <div className="flex justify-between items-center py-2">
                        <span className="text-muted-foreground text-sm font-semibold flex items-center gap-1.5"><Percent className="w-4 h-4" /> Apply Discount</span>
                        <div className="relative w-20">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={discountPercentage}
                                onChange={e => setDiscountPercentage(e.target.value ? Number(e.target.value) : "")}
                                placeholder="0"
                                className="w-full bg-secondary hover:bg-muted border border-transparent hover:border-border rounded-md px-3 py-1.5 text-right text-foreground text-sm font-bold focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold pointer-events-none">%</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-end mb-2 pt-2 border-t border-border border-dashed">
                        <div>
                            <span className="text-muted-foreground font-semibold block">Grand Total</span>
                            {discountVal > 0 && <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Saved ₹{discountAmount.toFixed(2)}</span>}
                            {roundOffAmount !== 0 && <span className="text-[10px] text-muted-foreground block">Round off: {roundOffAmount > 0 ? '+' : ''}{roundOffAmount.toFixed(2)}</span>}
                        </div>
                        <div className="text-right">
                            {discountVal > 0 && <span className="text-sm text-muted-foreground line-through mr-2">₹{cartSubTotal.toFixed(2)}</span>}
                            <span className="text-3xl font-bold text-primary tracking-tight">₹{cartGrandTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    {checkoutError && (
                        <p className="text-destructive text-xs font-bold text-center bg-destructive/10 py-2.5 rounded-lg border border-destructive/20 animate-in fade-in zoom-in-95 shadow-sm">
                            {checkoutError}
                        </p>
                    )}

                    <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || isCheckingOut}
                        className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg hover:-translate-y-0.5`}
                    >
                        {isCheckingOut ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                        ) : (
                            <><Printer className="w-5 h-5" /> Print Cash Memo</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}