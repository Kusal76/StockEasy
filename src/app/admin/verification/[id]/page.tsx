"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { ArrowLeft, FileText, Image as ImageIcon, CheckCircle2, XCircle, Loader2, ExternalLink, ShieldCheck } from "lucide-react";

export default function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const id = resolvedParams.id;
    const router = useRouter();

    const [shopData, setShopData] = useState<any>(null);
    const [ownerName, setOwnerName] = useState<string>("N/A");
    const [isLoading, setIsLoading] = useState(true);
    const [processingAction, setProcessingAction] = useState<"ACTIVE" | "REJECTED" | "RECOVER" | null>(null);
    const [adminNote, setAdminNote] = useState("");

    useEffect(() => {
        fetchShopAndOwnerDetails();
    }, [id]);

    const fetchShopAndOwnerDetails = async () => {
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

            // Relational Query: Fetch the shop AND its associated users
            const { data, error } = await supabase
                .from("shops")
                .select(`
                    *,
                    users (
                        full_name,
                        role,
                        email,
                        contact_number
                    )
                `)
                .eq("id", id)
                .single();

            if (error) throw error;

            setShopData(data);

            // Extract the Owner's name from the joined users table
            if (data.users && data.users.length > 0) {
                const owner = data.users.find((u: any) => u.role === "OWNER") || data.users[0];
                setOwnerName(owner.full_name || "N/A");

                // Fallback email just in case shop email is blank
                if (!data.email_address && owner.email) {
                    data.email_address = owner.email;
                }

                if (!data.contact_number && owner.contact_number) {
                    data.contact_number = owner.contact_number;
                }
            }
        } catch (error) {
            console.error("Error fetching shop data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDecision = async (decision: "ACTIVE" | "REJECTED") => {
        if (decision === "REJECTED" && !adminNote.trim()) {
            alert("Please provide a rejection reason in the notes field before rejecting.");
            return;
        }

        const actionText = decision === "ACTIVE" ? "approve" : "reject";
        if (!window.confirm(`Are you sure you want to ${actionText} this application and send the notification email?`)) return;

        setProcessingAction(decision);
        try {
            // 1. Update the internal admin note directly via Supabase so it saves to the record
            await supabase
                .from("shops")
                .update({ admin_notes: adminNote })
                .eq("id", id);

            // 2. Hit the secure API to change status and fire the NodeMailer email
            const res = await fetch('/api/admin/shops/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopId: id,
                    status: decision,
                    rejectionReason: adminNote
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            alert(`Application has been successfully ${decision.toLowerCase()} and the notification email has been dispatched.`);
            router.push("/admin/shops"); // Redirecting to the main directory makes more sense here
        } catch (error: any) {
            console.error("Decision error:", error);
            alert("Failed to process decision: " + error.message);
        } finally {
            setProcessingAction(null);
        }
    };

    const handleRecovery = async () => {
        if (!window.confirm("Recover this account and cancel the scheduled deletion?")) return;

        setProcessingAction("RECOVER");
        try {
            // 1. Recover the account: Set to ACTIVE and clear the deletion date
            const { error } = await supabase
                .from('shops')
                .update({ status: 'ACTIVE', scheduled_deletion_date: null })
                .eq('id', shopData.id);

            if (error) throw error;

            // 2. Reuse the review API to send the "Approved/Welcome" email again
            await fetch('/api/admin/shops/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shopId: shopData.id, status: 'ACTIVE', rejectionReason: "" })
            });

            alert("Account successfully recovered! The owner can now log in normally.");
            router.push("/admin/shops");
        } catch (e: any) {
            alert("Failed to recover account: " + e.message);
        } finally {
            setProcessingAction(null);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    };

    const handleViewDocument = (url: string | null) => {
        if (!url) return alert("Document was not uploaded by the user.");
        window.open(url, "_blank");
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p className="font-mono text-sm uppercase tracking-widest">Retrieving KYC Documents...</p>
            </div>
        );
    }

    if (!shopData) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground px-4 text-center">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Application Not Found</h1>
                <p className="mb-6 text-sm sm:text-base">The shop application ID #{id} does not exist or has been deleted.</p>
                <Link href="/admin/verification" className="text-primary hover:underline font-medium">Return to Queue</Link>
            </div>
        );
    }

    // Map schema documents for the UI array
    const complianceDocs = [
        { name: "Drug License", icon: FileText, url: shopData.doc_drug_license_url },
        { name: "Business PAN", icon: ImageIcon, url: shopData.doc_pan_url },
        { name: "GST Certificate", icon: FileText, url: shopData.doc_gst_url },
        { name: "Shop Photo", icon: ImageIcon, url: shopData.doc_shop_photo_url },
    ];

    return (
        <div className="max-w-6xl animate-in fade-in duration-500 space-y-6 pb-20">

            {/* Top Navigation & Header - FIX: Stack on mobile */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <Link
                        href="/admin/shops"
                        className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 bg-card border border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Link>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate leading-tight">
                        Review <span className="hidden sm:inline">Application</span> - {shopData.name || "Unnamed"}
                    </h1>
                </div>
                <div className="bg-card border border-border px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-mono text-muted-foreground shadow-sm shrink-0">
                    ID: {shopData.id.split('-')[0]}
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 sm:gap-8">

                {/* Left Column: Submitted Information */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm transition-colors">
                        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-border bg-muted/30">
                            <h2 className="font-semibold text-foreground text-sm sm:text-base">Submitted Information</h2>
                        </div>

                        <div className="divide-y divide-border/50">
                            {[
                                { label: "Owner", value: ownerName },
                                { label: "Email", value: shopData.email_address || "N/A", highlight: true },
                                { label: "Contact", value: shopData.contact_number || "N/A" },
                                { label: "Shop Name", value: shopData.name || "N/A", highlight: true },
                                { label: "Business Type", value: shopData.business_type || "N/A" },
                                { label: "Business PAN", value: shopData.pan_number || "N/A", highlight: true },
                                { label: "GST Number", value: shopData.gst_number || "N/A" },
                                { label: "Drug License", value: shopData.license_number || "N/A", highlight: true },
                                { label: "License Expiry", value: formatDate(shopData.license_expiry) },
                                { label: "Address", value: shopData.address || "N/A", highlight: true },
                                { label: "Submitted", value: formatDate(shopData.created_at) },
                            ].map((row, idx) => (
                                // FIX: flex-col on mobile, flex-row on desktop so long values don't break the layout
                                <div key={idx} className={`flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-3 sm:py-3.5 gap-1 sm:gap-0 ${row.highlight ? 'bg-muted/20' : ''}`}>
                                    <div className="w-full sm:w-1/3 text-xs sm:text-sm text-muted-foreground">{row.label}</div>
                                    <div className="w-full sm:w-2/3 text-sm font-medium text-foreground break-words">{row.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Documents & Decision */}
                <div className="md:col-span-1 space-y-6">

                    {/* Documents Section */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm transition-colors">
                        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-border bg-muted/30">
                            <h2 className="font-semibold text-foreground text-sm sm:text-base">Uploaded Documents</h2>
                        </div>
                        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                            {complianceDocs.map((doc, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleViewDocument(doc.url)}
                                    disabled={!doc.url}
                                    className="w-full flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 border border-border rounded-lg hover:border-primary/50 hover:bg-muted transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent"
                                >
                                    <div className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded flex items-center justify-center transition-transform ${doc.url ? 'bg-primary/10 text-primary group-hover:scale-110' : 'bg-muted text-muted-foreground'}`}>
                                        <doc.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </div>
                                    {/* FIX: min-w-0 ensures truncation works */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                                            {doc.url ? "Click to view document" : "Not Provided"}
                                        </p>
                                    </div>
                                    {doc.url && <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Decision Section */}
                    <div className={`bg-card border ${shopData.status === 'PENDING_DELETION' ? 'border-destructive/50' : 'border-border'} rounded-xl overflow-hidden shadow-sm relative transition-colors`}>
                        <div className={`absolute top-0 left-0 w-full h-1 ${shopData.status === 'PENDING_DELETION' ? 'bg-destructive' : 'bg-warning'}`} />
                        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-border bg-muted/30">
                            <h2 className="font-semibold text-foreground text-sm sm:text-base">Decision Panel</h2>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4">

                            {shopData.status === 'PENDING_DELETION' ? (
                                <>
                                    <div className="p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-xl mb-4">
                                        <p className="text-xs sm:text-sm text-destructive font-bold mb-1">Account Frozen</p>
                                        <p className="text-[10px] sm:text-xs text-destructive/80 leading-relaxed">
                                            This pharmacy is scheduled to be permanently deleted on {formatDate(shopData.scheduled_deletion_date)}.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleRecovery}
                                        disabled={processingAction !== null}
                                        className="w-full py-2.5 sm:py-3 bg-emerald-500 text-white rounded-lg font-bold text-sm sm:text-base hover:bg-emerald-600 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {processingAction === "RECOVER" ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />}
                                        Recover Account
                                    </button>
                                </>
                            ) : (
                                <>
                                    <textarea
                                        placeholder="Add internal note / rejection reason..."
                                        rows={3}
                                        value={adminNote}
                                        onChange={(e) => setAdminNote(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg p-3 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder:text-muted-foreground/50 transition-colors"
                                    />

                                    <button
                                        onClick={() => handleDecision("ACTIVE")}
                                        disabled={processingAction !== null || shopData.status === "ACTIVE"}
                                        className="w-full py-2.5 sm:py-3 bg-primary text-primary-foreground rounded-lg font-bold text-sm sm:text-base hover:bg-primary/90 transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {processingAction === "ACTIVE" ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                                        Approve Shop
                                    </button>

                                    <button
                                        onClick={() => handleDecision("REJECTED")}
                                        disabled={processingAction !== null || shopData.status === "REJECTED"}
                                        className="w-full py-2.5 sm:py-3 border border-border text-muted-foreground rounded-lg font-medium text-sm sm:text-base hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {processingAction === "REJECTED" ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
                                        Reject Application
                                    </button>
                                </>
                            )}

                            <div className="pt-3 sm:pt-4 border-t border-border flex items-center justify-between text-[10px] sm:text-xs font-mono uppercase tracking-wider">
                                <span className="text-muted-foreground">Current Status:</span>
                                <span className={`font-bold ${shopData.status === 'PENDING' ? 'text-warning' :
                                    shopData.status === 'ACTIVE' ? 'text-emerald-500' :
                                        shopData.status === 'PENDING_DELETION' ? 'text-red-500' : 'text-destructive'
                                    }`}>
                                    {shopData.status === 'PENDING_DELETION' ? 'DELETING' : (shopData.status || 'PENDING')}
                                </span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}