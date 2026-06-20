"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { History, Search, Receipt, Calendar, User, ChevronDown, ChevronUp, Loader2, CreditCard, Banknote, Smartphone, Download, Printer } from "lucide-react";

interface BillItem {
    id: string;
    medicine_name: string;
    batch_number?: string;
    expiry_date?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
}

interface Bill {
    id: string;
    customer_name: string;
    customer_phone: string;
    subtotal?: number;
    discount_percentage?: number;
    total_amount: number;
    payment_method: string;
    created_at: string;
    bill_items: BillItem[];
}

export default function BillsHistoryPage() {
    const [bills, setBills] = useState<Bill[]>([]);
    const [displayBills, setDisplayBills] = useState<Bill[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<"All Time" | "Today" | "This Week" | "This Month">("This Month");

    const [shopName, setShopName] = useState<string>("PHARMACY STORE");
    const [shopPhone, setShopPhone] = useState<string>("Not Provided");
    const [shopAddress, setShopAddress] = useState<string>("");
    const [licenceNumber, setLicenceNumber] = useState<string>("Not Provided");
    const [gstNumber, setGstNumber] = useState<string>("Not Registered");

    useEffect(() => {
        fetchBillsAndShopContext();
    }, []);

    useEffect(() => {
        let filtered = bills;

        const now = new Date();
        filtered = filtered.filter(bill => {
            if (dateFilter === "All Time") return true;

            const billDate = new Date(bill.created_at);
            if (dateFilter === "Today") {
                return billDate.toDateString() === now.toDateString();
            }
            if (dateFilter === "This Week") {
                const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
                return billDate >= firstDay;
            }
            if (dateFilter === "This Month") {
                return billDate.getMonth() === new Date().getMonth() && billDate.getFullYear() === new Date().getFullYear();
            }
            return true;
        });

        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(bill =>
                (bill.customer_name && bill.customer_name.toLowerCase().includes(lowerQuery)) ||
                (bill.customer_phone && bill.customer_phone.includes(lowerQuery)) ||
                bill.id.toLowerCase().includes(lowerQuery)
            );
        }

        setDisplayBills(filtered);
    }, [searchQuery, dateFilter, bills]);

    const fetchBillsAndShopContext = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: userData, error: userError } = await supabase.from('users').select('*').eq('id', user.id).single();
            if (userError) throw userError;

            if (userData) {
                const phoneVal = userData.contact_number || userData.phone;
                if (phoneVal) setShopPhone(phoneVal);

                if (userData.shop_id) {
                    const { data: shopData } = await supabase.from('shops').select('*').eq('id', userData.shop_id).single();
                    if (shopData) {
                        if (shopData.name) setShopName(shopData.name);
                        if (shopData.address) setShopAddress(shopData.address);
                        if (shopData.license_number || shopData.licence_number) setLicenceNumber(shopData.license_number || shopData.licence_number);
                        if (shopData.gst_number || shopData.gstin) setGstNumber(shopData.gst_number || shopData.gstin);
                    }

                    const { data: billsData, error: billsError } = await supabase
                        .from('bills')
                        .select(`*, bill_items (*)`)
                        .eq('shop_id', userData.shop_id)
                        .order('created_at', { ascending: false });

                    if (billsError) throw billsError;
                    setBills(billsData || []);
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedBillId(prev => prev === id ? null : id);
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return {
            date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        };
    };

    const getPaymentIcon = (method: string) => {
        if (method === "Card") return <CreditCard className="w-4 h-4 text-info" />;
        if (method === "UPI" || method === "UPI / UPI") return <Smartphone className="w-4 h-4 text-primary" />;
        return <Banknote className="w-4 h-4 text-warning" />;
    };

    const handleExportCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Bill ID,Date,Time,Customer Name,Phone,Payment Method,Items Count,Subtotal (Rs),Discount (%),Total Amount (Rs)\n";

        displayBills.forEach(bill => {
            const { date, time } = formatDateTime(bill.created_at);
            const subT = bill.subtotal || bill.total_amount;
            const disc = bill.discount_percentage || 0;

            const row = [
                bill.id.split('-')[0],
                date,
                time,
                bill.customer_name || 'Walk-in',
                bill.customer_phone || 'N/A',
                bill.payment_method,
                bill.bill_items.length,
                subT.toFixed(2),
                disc.toFixed(1),
                bill.total_amount.toFixed(2) // already rounded from db
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `StockEasy_Sales_${dateFilter.replace(" ", "")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = (bill: Bill) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const billDate = new Date(bill.created_at);
        const dateStr = billDate.toLocaleDateString('en-IN');
        const timeStr = billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        const logoUrl = `${window.location.origin}/Receipt_logo.png`;

        // Calculate Rounded Math
        const subTotal = bill.subtotal || bill.total_amount;
        const discountPct = bill.discount_percentage || 0;
        const discountAmt = (subTotal * discountPct) / 100;
        const rawTotal = subTotal - discountAmt;
        const grandTotal = bill.total_amount; // This is inherently rounded because DB saved it rounded
        const roundOff = grandTotal - rawTotal;

        let itemsHtml = bill.bill_items.map(item => `
            <tr>
                <td style="text-align: center;">${item.quantity}</td>
                <td>${item.medicine_name}</td>
                <td style="text-align: center;">${item.batch_number || '--'}</td>
                <td style="text-align: center;">${item.expiry_date || '--'}</td>
                <td style="text-align: right;">${item.total_price.toFixed(2)}</td>
            </tr>
        `).join('');

        for (let i = bill.bill_items.length; i < 5; i++) {
            itemsHtml += `
                <tr>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                </tr>
            `;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>Cash Memo #${bill.id.substring(0, 8).toUpperCase()} (Reprint)</title>
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
                        <div class="cash-memo-badge">CASH MEMO (DUPLICATE)</div>
                    </div>
                </div>

                <div class="header">
                    <h1>${shopName}</h1>
                    <p>${shopAddress ? `${shopAddress} | ` : ''}Ph: ${shopPhone}</p>
                </div>

                <div class="divider"></div>

                <div class="info-grid">
                    <div>
                        <strong>Name :</strong> ${bill.customer_name}<br>
                        <strong>Dr. &nbsp;&nbsp;&nbsp;&nbsp;:</strong> 
                    </div>
                    <div>
                        <strong>Invoice No:</strong> ${bill.id.substring(0, 8).toUpperCase()}<br>
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

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in duration-500 space-y-8">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <History className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">Bills / Sales History</h1>
                        <p className="text-muted-foreground text-sm">View and audit your past generated bills.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search customer or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative bg-card border border-border rounded-xl flex items-center px-3 py-2.5">
                            <Calendar className="w-4 h-4 text-muted-foreground mr-2" />
                            <span className="text-sm text-muted-foreground mr-1">Date:</span>
                            <select
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value as any)}
                                className="bg-transparent text-foreground text-sm font-bold focus:outline-none cursor-pointer appearance-none pr-4"
                            >
                                <option className="bg-card" value="Today">Today</option>
                                <option className="bg-card" value="This Week">This week</option>
                                <option className="bg-card" value="This Month">This month</option>
                                <option className="bg-card" value="All Time">All time</option>
                            </select>
                            <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-3 pointer-events-none" />
                        </div>

                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 bg-card border border-border hover:bg-muted/50 text-foreground px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer"
                        >
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden min-h-[400px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                        <p>Loading transactions...</p>
                    </div>
                ) : displayBills.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <Receipt className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-lg font-medium text-foreground mb-1">No bills found</p>
                        <p className="text-sm">No transactions match your current filters.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {displayBills.map((bill) => {
                            const { date, time } = formatDateTime(bill.created_at);
                            const isExpanded = expandedBillId === bill.id;

                            const subT = bill.subtotal || bill.total_amount;
                            const discPct = bill.discount_percentage || 0;
                            const discAmt = (subT * discPct) / 100;
                            const rawTotal = subT - discAmt;
                            const roundOff = bill.total_amount - rawTotal;

                            return (
                                <div key={bill.id} className="flex flex-col">
                                    <div
                                        onClick={() => toggleExpand(bill.id)}
                                        className={`p-6 flex items-center justify-between cursor-pointer transition-colors ${isExpanded ? 'bg-muted/40' : 'hover:bg-muted/20'}`}
                                    >
                                        <div className="flex items-center gap-6">
                                            <div className="bg-background border border-border rounded-lg p-3 flex flex-col items-center justify-center min-w-[90px]">
                                                <span className="text-xs text-muted-foreground font-mono">{time}</span>
                                                <span className="text-sm font-bold text-foreground">{date}</span>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-primary" />
                                                    <span className="font-bold text-foreground text-lg">{bill.customer_name || "Walk-in Customer"}</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
                                                    <span>{bill.customer_phone || "No Phone"}</span>
                                                    <span>•</span>
                                                    <span className="text-xs">ID: {bill.id.split('-')[0]}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-8">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-2xl font-bold text-primary tracking-tight">₹{bill.total_amount.toFixed(2)}</span>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-background px-2 py-1 rounded border border-border">
                                                    {getPaymentIcon(bill.payment_method)}
                                                    {bill.payment_method}
                                                </div>
                                            </div>
                                            <div className="text-muted-foreground bg-background p-2 rounded-full border border-border">
                                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="bg-background/80 p-6 border-t border-border animate-in slide-in-from-top-2 duration-200">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                    <Receipt className="w-4 h-4" /> Receipt Details
                                                </h4>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownloadPDF(bill);
                                                    }}
                                                    className="flex items-center gap-2 text-xs font-bold text-primary hover:text-primary-foreground bg-primary/10 hover:bg-primary border border-primary/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <Printer className="w-3 h-3" /> Reprint Cash Memo
                                                </button>
                                            </div>

                                            <div className="bg-card border border-border rounded-xl overflow-hidden">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="text-xs uppercase tracking-wider text-muted-foreground font-mono border-b border-border bg-muted/20">
                                                            <th className="px-6 py-3 font-medium">Item</th>
                                                            <th className="px-6 py-3 font-medium text-center">Qty</th>
                                                            <th className="px-6 py-3 font-medium text-right">Price</th>
                                                            <th className="px-6 py-3 font-medium text-right">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border">
                                                        {bill.bill_items.map(item => (
                                                            <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                                                                <td className="px-6 py-3 font-bold text-foreground text-sm">{item.medicine_name}</td>
                                                                <td className="px-6 py-3 text-sm text-foreground font-mono text-center">{item.quantity}</td>
                                                                <td className="px-6 py-3 text-sm text-muted-foreground font-mono text-right">₹{item.unit_price.toFixed(2)}</td>
                                                                <td className="px-6 py-3 text-sm font-bold text-primary font-mono text-right">₹{item.total_price.toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>

                                                <div className="bg-muted/10 border-t border-border p-4 flex flex-col items-end gap-1">
                                                    {discPct > 0 && (
                                                        <>
                                                            <div className="flex justify-between w-56 text-sm text-muted-foreground font-mono">
                                                                <span>Subtotal:</span>
                                                                <span>₹{subT.toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex justify-between w-56 text-sm text-primary font-mono">
                                                                <span>Discount ({discPct}%):</span>
                                                                <span>-₹{discAmt.toFixed(2)}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                    {roundOff !== 0 && (
                                                        <div className="flex justify-between w-56 text-sm text-muted-foreground font-mono">
                                                            <span>Round Off:</span>
                                                            <span>{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between w-56 text-base font-bold text-foreground font-mono mt-1 pt-1 border-t border-border">
                                                        <span>Grand Total:</span>
                                                        <span>₹{bill.total_amount.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}