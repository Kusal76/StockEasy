"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Loader2, Search, CheckCircle2, Clock, Mail, User, ShieldAlert, ArrowRight, RefreshCw, Send, MessageSquare, X } from "lucide-react";

interface Ticket {
    id: string;
    displayId: string;
    name: string;
    email: string;
    message: string;
    status: string;
    admin_reply?: string;
    resolved_by?: string; // ADDED
    created_at: string;
}

export default function AdminSupportInbox() {
    const router = useRouter();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "RESOLVED">("OPEN");

    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [adminReplyText, setAdminReplyText] = useState("");
    const [isResolving, setIsResolving] = useState(false);

    // Hold current admin details for optimistic UI updates
    const [currentAdmin, setCurrentAdmin] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        verifyAdminAndFetchTickets();
    }, []);

    const verifyAdminAndFetchTickets = async () => {
        setIsRefreshing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");

            // --- STRICT VAULT CHECK ---
            const { data: platformAdmin } = await supabase
                .from('platform_admins')
                .select('role, is_active, full_name') // Fetch full_name
                .eq('id', user.id)
                .maybeSingle();

            if (!platformAdmin || !platformAdmin.is_active) {
                console.warn("Unauthorized access attempt to Support Inbox.");
                return router.push("/login");
            }

            // Save admin info to generate the optimistic signature later
            setCurrentAdmin({
                id: user.id,
                name: platformAdmin.full_name || "Admin"
            });

            // Fetch the tickets
            const { data, error } = await supabase
                .from('support_tickets')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const formattedData = data.map((t: any) => ({
                    ...t,
                    displayId: `TKT-${String(t.id).split('-')[0].toUpperCase()}`
                }));
                setTickets(formattedData);

                if (selectedTicket) {
                    const updatedSelected = formattedData.find((ft: Ticket) => ft.id === selectedTicket.id);
                    if (updatedSelected) setSelectedTicket(updatedSelected);
                }
            }
        } catch (error) {
            console.error("Error fetching tickets:", error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleSendReply = () => {
        if (!selectedTicket || !adminReplyText.trim()) return;
        if (!window.confirm("Send this reply and mark the ticket as resolved? An email will be sent to the user.")) return;

        const replyText = adminReplyText.trim();
        const ticketToResolve = selectedTicket;

        // Generate the optimistic signature
        const signature = currentAdmin ? `${currentAdmin.name} (${currentAdmin.id.substring(0, 8)})` : "Admin";

        // OPTIMISTIC UPDATE
        setTickets(prev => prev.map(t => t.id === ticketToResolve.id ? {
            ...t,
            status: 'RESOLVED',
            admin_reply: replyText,
            resolved_by: signature
        } : t));

        setSelectedTicket(prev => prev ? {
            ...prev,
            status: 'RESOLVED',
            admin_reply: replyText,
            resolved_by: signature
        } : null);

        setAdminReplyText("");

        // FIRE AND FORGET
        fetch('/api/admin/tickets/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dbId: ticketToResolve.id,
                displayId: ticketToResolve.displayId,
                email: ticketToResolve.email,
                name: ticketToResolve.name,
                originalMessage: ticketToResolve.message,
                adminReply: replyText
            })
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json();
                    console.error("Background Sync Error:", data.error);
                    alert(`Warning: The email for ${ticketToResolve.displayId} failed to send. Please check the logs.`);
                }
            })
            .catch((error) => {
                console.error("Network Error:", error);
                alert(`Warning: Network error while trying to reply to ${ticketToResolve.displayId}.`);
            });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-IN', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    const filteredTickets = tickets.filter(t => {
        const matchesSearch = t.displayId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-muted-foreground transition-colors">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p className="font-mono text-sm tracking-widest uppercase font-bold text-center px-4">Loading Helpdesk...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500 pb-10 sm:pb-20 h-auto md:h-[calc(100vh-100px)] flex flex-col transition-colors">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-4 border-b border-border mb-4 sm:mb-6 shrink-0">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Support Helpdesk</h1>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-1">Manage, reply, and resolve tenant support tickets.</p>
                </div>
                <button
                    onClick={verifyAdminAndFetchTickets}
                    disabled={isRefreshing}
                    className="w-full sm:w-auto px-4 py-2 bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
                    {isRefreshing ? "Syncing..." : "Sync Inbox"}
                </button>
            </div>

            {/* Main Split Interface */}
            <div className="flex-1 flex flex-col md:flex-row gap-4 sm:gap-6 md:min-h-0">

                {/* LEFT PANE: Ticket List */}
                <div className="w-full md:w-1/3 h-[400px] md:h-full bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden transition-colors shrink-0 md:shrink">
                    <div className="p-3 sm:p-4 border-b border-border bg-muted/20 space-y-3 sm:space-y-4">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search ID, name, or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors shadow-sm placeholder:text-muted-foreground/50"
                            />
                        </div>
                        <div className="flex bg-background p-1 rounded-lg border border-border">
                            <button
                                onClick={() => { setStatusFilter("OPEN"); setSelectedTicket(null); }}
                                className={`flex-1 text-[10px] sm:text-xs font-bold py-1.5 rounded-md transition-colors cursor-pointer ${statusFilter === "OPEN" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                Open
                            </button>
                            <button
                                onClick={() => { setStatusFilter("RESOLVED"); setSelectedTicket(null); }}
                                className={`flex-1 text-[10px] sm:text-xs font-bold py-1.5 rounded-md transition-colors cursor-pointer ${statusFilter === "RESOLVED" ? "bg-muted text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                Resolved
                            </button>
                            <button
                                onClick={() => { setStatusFilter("ALL"); setSelectedTicket(null); }}
                                className={`flex-1 text-[10px] sm:text-xs font-bold py-1.5 rounded-md transition-colors cursor-pointer ${statusFilter === "ALL" ? "bg-muted text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                All
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {filteredTickets.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm font-medium">No tickets found.</div>
                        ) : (
                            <div className="space-y-1">
                                {filteredTickets.map(ticket => (
                                    <button
                                        key={ticket.id}
                                        onClick={() => {
                                            setSelectedTicket(ticket);
                                            setAdminReplyText("");
                                            if (window.innerWidth < 768) {
                                                setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
                                            }
                                        }}
                                        className={`w-full text-left p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${selectedTicket?.id === ticket.id ? 'bg-primary/5 border-primary/50' : 'bg-transparent border-transparent hover:bg-muted/50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-mono text-[10px] sm:text-xs font-bold text-foreground">{ticket.displayId}</span>
                                            {ticket.status === 'OPEN' ? (
                                                <span className="w-2 h-2 rounded-full bg-warning animate-pulse shadow-sm" />
                                            ) : (
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                            )}
                                        </div>
                                        <div className="text-xs sm:text-sm font-bold text-foreground truncate">{ticket.name}</div>
                                        <div className="text-[10px] sm:text-xs text-muted-foreground truncate mb-1.5 sm:mb-2">{ticket.message}</div>
                                        <div className="text-[9px] sm:text-[10px] text-muted-foreground font-mono">{formatDate(ticket.created_at)}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT PANE: Ticket Details & Reply Editor */}
                <div className="w-full md:w-2/3 h-auto md:h-full bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden relative transition-colors">
                    {!selectedTicket ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center min-h-[300px]">
                            <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 mb-4 opacity-20" />
                            <p className="text-sm">Select a ticket from the inbox to view and respond.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full max-h-[800px] md:max-h-none">
                            {/* Detailed Header */}
                            <div className="p-4 sm:p-6 border-b border-border bg-muted/20 flex justify-between items-start shrink-0">
                                <div className="min-w-0 pr-2">
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                                        <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">{selectedTicket.displayId}</h2>
                                        {selectedTicket.status === 'OPEN' ? (
                                            <span className="px-2 py-0.5 bg-warning/10 border border-warning/20 text-warning text-[9px] sm:text-[10px] font-bold uppercase rounded shadow-sm shrink-0">Awaiting Reply</span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] sm:text-[10px] font-bold uppercase rounded shadow-sm shrink-0">Resolved</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] sm:text-xs font-mono text-muted-foreground">Submitted: {formatDate(selectedTicket.created_at)}</p>
                                </div>

                                <button
                                    onClick={() => setSelectedTicket(null)}
                                    className="p-2 -mr-2 -mt-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors cursor-pointer shrink-0"
                                    title="Close ticket"
                                >
                                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                                </button>
                            </div>

                            {/* Ticket Content Area */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 sm:space-y-6">
                                {/* Sender Info Card */}
                                <div className="p-3 sm:p-4 bg-background border border-border rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 shadow-sm">
                                    <div className="space-y-1">
                                        <label className="text-[9px] sm:text-[10px] uppercase font-mono tracking-widest text-muted-foreground flex items-center gap-1.5"><User className="w-3 h-3" /> Sender Name</label>
                                        <p className="text-xs sm:text-sm font-bold text-foreground truncate">{selectedTicket.name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] sm:text-[10px] uppercase font-mono tracking-widest text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" /> Email Address</label>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs sm:text-sm font-medium text-foreground truncate">{selectedTicket.email}</p>
                                            <a href={`mailto:${selectedTicket.email}?subject=RE: Support Ticket ${selectedTicket.displayId}`} className="text-primary hover:bg-primary/10 p-1 rounded transition-colors shrink-0" title="Reply via Email Client">
                                                <Send className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Message Body */}
                                <div>
                                    <h3 className="text-xs sm:text-sm font-bold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wider">User Request / Issue</h3>
                                    <div className="p-4 sm:p-6 bg-muted/20 border border-border rounded-xl">
                                        <p className="text-foreground text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                            {selectedTicket.message}
                                        </p>
                                    </div>
                                </div>

                                {/* Dynamic Reply Section */}
                                {selectedTicket.status === 'OPEN' ? (
                                    <div className="space-y-3 animate-in fade-in pt-4 border-t border-border">
                                        <h3 className="text-xs sm:text-sm font-bold text-primary mb-2 sm:mb-3 uppercase tracking-wider flex items-center gap-2">
                                            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Draft Resolution
                                        </h3>
                                        <textarea
                                            rows={5}
                                            value={adminReplyText}
                                            onChange={(e) => setAdminReplyText(e.target.value)}
                                            placeholder="Write your response to the user here. This will be sent directly to their email..."
                                            className="w-full bg-background border border-primary/30 rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder:text-muted-foreground/70 shadow-sm transition-colors"
                                        />
                                        <div className="flex justify-end">
                                            <button
                                                onClick={handleSendReply}
                                                disabled={isResolving || !adminReplyText.trim()}
                                                className="w-full sm:w-auto px-6 py-2.5 sm:py-3 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-lg text-sm flex justify-center items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                                            >
                                                {isResolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                Send Reply & Resolve
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3 animate-in fade-in pt-4 border-t border-border">
                                        {/* SIGNATURE ADDED HERE */}
                                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                                            <h3 className="text-xs sm:text-sm font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                                                <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Administrative Resolution
                                            </h3>
                                            {selectedTicket.resolved_by && (
                                                <span className="text-[9px] sm:text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded border border-border shadow-sm">
                                                    By: {selectedTicket.resolved_by}
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-4 sm:p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-sm">
                                            <p className="text-foreground text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                                                {selectedTicket.admin_reply || "Ticket resolved without a text response."}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}