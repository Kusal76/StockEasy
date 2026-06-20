"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Loader2, Search, CheckCircle2, Clock, Mail, User, ShieldAlert, ArrowRight, RefreshCw, Send, MessageSquare } from "lucide-react";

interface Ticket {
    id: string; // The UUID from database
    displayId: string; // The TKT-XXXX formatted ID
    name: string;
    email: string;
    message: string;
    status: string;
    admin_reply?: string; // New field from our ALTER TABLE
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

    useEffect(() => {
        verifyAdminAndFetchTickets();
    }, []);

    const verifyAdminAndFetchTickets = async () => {
        setIsRefreshing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push("/login");

            const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
            if (userData?.role !== "SUPERADMIN" && userData?.role !== "ADMIN") return router.push("/dashboard");

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

                // If a ticket is currently selected, update its state too
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

    // Upgraded handle function with Optimistic UI (Instant Feedback)
    const handleSendReply = () => {
        if (!selectedTicket || !adminReplyText.trim()) return;
        if (!window.confirm("Send this reply and mark the ticket as resolved? An email will be sent to the user.")) return;

        // 1. Capture the exact text and ticket data before we clear it
        const replyText = adminReplyText.trim();
        const ticketToResolve = selectedTicket;

        // 2. OPTIMISTIC UPDATE: Instantly update the UI so the admin doesn't wait!
        setTickets(prev => prev.map(t => t.id === ticketToResolve.id ? {
            ...t,
            status: 'RESOLVED',
            admin_reply: replyText
        } : t));

        setSelectedTicket(prev => prev ? {
            ...prev,
            status: 'RESOLVED',
            admin_reply: replyText
        } : null);

        setAdminReplyText(""); // Instantly clear the text box

        // 3. FIRE AND FORGET: Run the heavy API/Email call silently in the background
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
                    // If the background email fails, alert the admin so they know it didn't go through
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
                <p className="font-mono text-sm tracking-widest uppercase">Loading Helpdesk...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500 pb-20 h-[calc(100vh-100px)] flex flex-col transition-colors">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-border mb-6 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Support Helpdesk</h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage, reply, and resolve tenant support tickets.</p>
                </div>
                <button
                    onClick={verifyAdminAndFetchTickets}
                    disabled={isRefreshing}
                    className="px-4 py-2 bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground text-sm font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
                    {isRefreshing ? "Syncing..." : "Sync Inbox"}
                </button>
            </div>

            {/* Main Split Interface */}
            <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">

                {/* LEFT PANE: Ticket List */}
                <div className="w-full md:w-1/3 bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden transition-colors">
                    <div className="p-4 border-b border-border bg-muted/20 space-y-4">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search ID, name, or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors shadow-sm"
                            />
                        </div>
                        <div className="flex bg-background p-1 rounded-lg border border-border">
                            <button
                                onClick={() => setStatusFilter("OPEN")}
                                className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors cursor-pointer ${statusFilter === "OPEN" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                Open
                            </button>
                            <button
                                onClick={() => setStatusFilter("RESOLVED")}
                                className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors cursor-pointer ${statusFilter === "RESOLVED" ? "bg-muted text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                Resolved
                            </button>
                            <button
                                onClick={() => setStatusFilter("ALL")}
                                className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors cursor-pointer ${statusFilter === "ALL" ? "bg-muted text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                All
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {filteredTickets.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">No tickets found.</div>
                        ) : (
                            <div className="space-y-1">
                                {filteredTickets.map(ticket => (
                                    <button
                                        key={ticket.id}
                                        onClick={() => {
                                            setSelectedTicket(ticket);
                                            setAdminReplyText(""); // Clear text box when switching tickets
                                        }}
                                        className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${selectedTicket?.id === ticket.id ? 'bg-primary/5 border-primary/50' : 'bg-transparent border-transparent hover:bg-muted/50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-mono text-xs font-bold text-foreground">{ticket.displayId}</span>
                                            {ticket.status === 'OPEN' ? (
                                                <span className="w-2 h-2 rounded-full bg-warning animate-pulse shadow-sm" />
                                            ) : (
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                            )}
                                        </div>
                                        <div className="text-sm font-bold text-foreground truncate">{ticket.name}</div>
                                        <div className="text-xs text-muted-foreground truncate mb-2">{ticket.message}</div>
                                        <div className="text-[10px] text-muted-foreground font-mono">{formatDate(ticket.created_at)}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT PANE: Ticket Details & Reply Editor */}
                <div className="w-full md:w-2/3 bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden relative transition-colors">
                    {!selectedTicket ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                            <p>Select a ticket from the inbox to view and respond.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            {/* Detailed Header */}
                            <div className="p-6 border-b border-border bg-muted/20 flex justify-between items-start shrink-0">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-xl font-bold text-foreground">{selectedTicket.displayId}</h2>
                                        {selectedTicket.status === 'OPEN' ? (
                                            <span className="px-2 py-0.5 bg-warning/10 border border-warning/20 text-warning text-[10px] font-bold uppercase rounded shadow-sm">Awaiting Reply</span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase rounded shadow-sm">Resolved</span>
                                        )}
                                    </div>
                                    <p className="text-xs font-mono text-muted-foreground">Submitted: {formatDate(selectedTicket.created_at)}</p>
                                </div>
                            </div>

                            {/* Ticket Content Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Sender Info Card */}
                                <div className="p-4 bg-background border border-border rounded-xl grid grid-cols-2 gap-4 shadow-sm">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground flex items-center gap-1.5"><User className="w-3 h-3" /> Sender Name</label>
                                        <p className="text-sm font-bold text-foreground">{selectedTicket.name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" /> Email Address</label>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-foreground">{selectedTicket.email}</p>
                                            <a href={`mailto:${selectedTicket.email}?subject=RE: Support Ticket ${selectedTicket.displayId}`} className="text-primary hover:bg-primary/10 p-1 rounded transition-colors" title="Reply via Email Client">
                                                <Send className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Message Body */}
                                <div>
                                    <h3 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">User Request / Issue</h3>
                                    <div className="p-6 bg-muted/20 border border-border rounded-xl">
                                        <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                            {selectedTicket.message}
                                        </p>
                                    </div>
                                </div>

                                {/* Dynamic Reply Section */}
                                {selectedTicket.status === 'OPEN' ? (
                                    <div className="space-y-3 animate-in fade-in pt-4 border-t border-border">
                                        <h3 className="text-sm font-bold text-primary mb-3 uppercase tracking-wider flex items-center gap-2">
                                            <Send className="w-4 h-4" /> Draft Resolution
                                        </h3>
                                        <textarea
                                            rows={5}
                                            value={adminReplyText}
                                            onChange={(e) => setAdminReplyText(e.target.value)}
                                            placeholder="Write your response to the user here. This will be sent directly to their email..."
                                            className="w-full bg-background border border-primary/30 rounded-xl p-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none placeholder:text-muted-foreground shadow-sm transition-colors"
                                        />
                                        <div className="flex justify-end">
                                            <button
                                                onClick={handleSendReply}
                                                disabled={isResolving || !adminReplyText.trim()}
                                                className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-lg text-sm flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                                            >
                                                {isResolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                Send Reply & Resolve
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3 animate-in fade-in pt-4 border-t border-border">
                                        <h3 className="text-sm font-bold text-emerald-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                                            <ShieldAlert className="w-4 h-4" /> Administrative Resolution
                                        </h3>
                                        <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-sm">
                                            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
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