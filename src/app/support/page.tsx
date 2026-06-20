"use client";

import { useState, useRef, useEffect } from 'react';
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Mail, MessageSquare, Phone, Send, X, Loader2, CheckCircle2 } from 'lucide-react'

interface ChatMessage {
    role: "agent" | "user";
    text: string;
}

export default function SupportPage() {
    // --- LIVE TICKET FORM STATE ---
    const [ticketForm, setTicketForm] = useState({ name: "", email: "", message: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successTicket, setSuccessTicket] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState("");

    // --- LIVE AI CHAT STATE ---
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [isChatTyping, setIsChatTyping] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        { role: "agent", text: "Hi there! I'm the StockEasy AI Support Agent. Ask me about pricing, how to use the app, or troubleshooting!" }
    ]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll chat
    useEffect(() => {
        if (isChatOpen) {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatMessages, isChatOpen, isChatTyping]);

    // --- PRODUCTION HANDLERS ---

    // 1. Production Ticket Submission
    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError("");
        if (!ticketForm.name || !ticketForm.email || !ticketForm.message) return;

        setIsSubmitting(true);

        try {
            const res = await fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ticketForm)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to submit ticket");

            // Capture the generated Ticket ID from the backend
            setSuccessTicket(data.ticketId);
            setTicketForm({ name: "", email: "", message: "" });

        } catch (error: any) {
            console.error("Ticket Error:", error);
            setSubmitError(error.message || "Something went wrong. Please try emailing us directly.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // 2. Production AI Chat Integration with KNOWLEDGE BASE
    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || isChatTyping) return;

        const userText = chatInput.trim();
        setChatInput("");
        setChatMessages(prev => [...prev, { role: "user", text: userText }]);
        setIsChatTyping(true);

        try {
            // --- THE STOCKEASY AI BRAIN (SYSTEM PROMPT) ---
            const supportContext = `
            You are the official Customer Support AI for "StockEasy", a cloud-based Pharmacy Management & Inventory SaaS.
            Your tone is professional, empathetic, extremely concise, and helpful. 
            Do NOT hallucinate features. Only answer based on the following Knowledge Base:

            **PRICING & LIMITS:**
            - Starter Plan (Free): 1 User (Owner only), Max 5 Catalog Medicines, Max 2 Dealers. Basic tracking.
            - Growth Plan (Rs 599/mo): Up to 5 Staff Users, Max 50 Medicines, Max 10 Dealers.
            - Pro Plan (Rs 1499/mo): Unlimited everything, Full Enterprise Analytics, and AI Assistant.

            **COMMON TROUBLESHOOTING (FAQs):**
            1. "How do I add staff?" -> Tell them to go to 'Settings > Staff'. If they are on Starter, tell them they must upgrade to Growth/Pro first.
            2. "Why can't I add a new medicine or dealer?" -> Tell them they have reached their plan's limit (5 for Starter, 50 for Growth). Tell them to upgrade in the Subscription tab.
            3. "How do I generate a bill?" -> Go to the 'Sell' tab, select the medicines, click 'Checkout', and it will generate a printable invoice.
            4. "Where are my analytics?" -> The Analytics dashboard is locked for Starter and Growth users. They need the Pro Plan to view charts and expiry trends.
            5. "How do I update my shop logo?" -> Go to 'Settings > Shop Profile' and upload it there.

            If a user asks a complex technical question or something not in this knowledge base, politely say: "I recommend submitting a support ticket below or emailing us directly at kusaldey2027@gmail.com so our technical team can assist you."
            `;

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userText, shopContext: supportContext })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to get AI response");

            setChatMessages(prev => [...prev, { role: "agent", text: data.text }]);
        } catch (error: any) {
            console.error("Chat Error:", error);
            setChatMessages(prev => [...prev, {
                role: "agent",
                text: "⚠️ I'm having trouble connecting to my servers right now. Please submit a ticket below."
            }]);
        } finally {
            setIsChatTyping(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col relative">
            <Header />

            {/* --- FLOATING LIVE CHAT WIDGET --- */}
            {isChatOpen && (
                <div className="fixed bottom-6 right-6 w-80 sm:w-[380px] bg-card border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
                    {/* Chat Header */}
                    <div className="bg-primary px-4 py-3 flex justify-between items-center text-[#051424]">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5" />
                            <h3 className="font-bold text-sm">StockEasy AI Support</h3>
                        </div>
                        <button onClick={() => setIsChatOpen(false)} className="hover:bg-black/10 p-1 rounded-md transition-colors cursor-pointer">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Chat Body */}
                    <div className="h-[350px] bg-background/50 p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
                        <p className="text-[10px] text-muted-foreground text-center mb-2">Powered by Google Gemini AI</p>
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3 rounded-xl text-sm max-w-[85%] ${msg.role === 'user'
                                    ? 'bg-primary text-[#051424] rounded-br-sm shadow-md'
                                    : 'bg-card border border-border text-foreground rounded-bl-sm shadow-sm whitespace-pre-wrap'
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isChatTyping && (
                            <div className="flex justify-start">
                                <div className="p-3 bg-card border border-border rounded-xl rounded-bl-sm shadow-sm flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-75"></span>
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-150"></span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <form onSubmit={handleChatSubmit} className="p-3 bg-card border-t border-border flex gap-2">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
                            placeholder="Type a message..."
                            disabled={isChatTyping}
                        />
                        <button
                            type="submit"
                            disabled={!chatInput.trim() || isChatTyping}
                            className="bg-primary text-[#051424] p-2 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            )}

            <main className="flex-1 w-full max-w-[1280px] mx-auto px-6 md:px-16 pt-32 pb-24">
                <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">How can we help?</h1>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                        Whether you have a question about features, pricing, or need technical assistance with your inventory, our team is ready to answer all your questions.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-16">
                    <div className="bg-card border border-border p-8 rounded-lg text-center hover:border-primary/50 transition-colors duration-300 shadow-sm hover:shadow-md animate-in fade-in zoom-in-95 fill-mode-both" style={{ animationDelay: '100ms' }}>
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <MessageSquare className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">AI Chat Support</h3>
                        <p className="text-sm text-muted-foreground mb-6">Instant answers powered by Gemini.</p>
                        <button
                            onClick={() => setIsChatOpen(true)}
                            className="text-primary text-sm font-medium hover:underline underline-offset-4 cursor-pointer"
                        >
                            Start Live Chat
                        </button>
                    </div>

                    <div className="bg-card border border-border p-8 rounded-lg text-center hover:border-primary/50 transition-colors duration-300 shadow-sm hover:shadow-md animate-in fade-in zoom-in-95 fill-mode-both" style={{ animationDelay: '200ms' }}>
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Mail className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Email Us</h3>
                        <p className="text-sm text-muted-foreground mb-6">We aim to respond within 24 hours.</p>
                        <a href="mailto:kusaldey2027@gmail.com" className="text-primary text-sm font-medium hover:underline underline-offset-4">kusaldey2027@gmail.com</a>
                    </div>

                    <div className="bg-card border border-border p-8 rounded-lg text-center hover:border-primary/50 transition-colors duration-300 shadow-sm hover:shadow-md animate-in fade-in zoom-in-95 fill-mode-both" style={{ animationDelay: '300ms' }}>
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Phone className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Call Center</h3>
                        <p className="text-sm text-muted-foreground mb-6">Mon-Fri from 9am to 6pm IST.</p>
                        <a href="tel:+919876543210" className="text-primary text-sm font-medium hover:underline underline-offset-4">+91 74396 89051</a>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto bg-card border border-border p-8 md:p-10 rounded-xl relative overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                    <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

                    <h2 className="text-2xl font-bold text-foreground mb-8">Send us a message</h2>

                    {successTicket ? (
                        <div className="bg-primary/10 border border-primary/30 rounded-xl p-8 text-center animate-in zoom-in duration-300">
                            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
                            <h3 className="text-2xl font-bold text-foreground mb-2">Ticket Submitted!</h3>
                            <p className="text-muted-foreground mb-2">
                                Your ticket reference is <strong className="text-primary font-mono text-lg ml-1">{successTicket}</strong>
                            </p>
                            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                                A confirmation email has been sent to your inbox. Our support team will review your issue and get back to you shortly.
                            </p>
                            <button
                                onClick={() => setSuccessTicket(null)}
                                className="px-6 py-2.5 bg-background border border-border text-foreground font-medium rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                Submit another ticket
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleTicketSubmit} className="space-y-6 relative z-10">
                            {submitError && (
                                <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg">
                                    {submitError}
                                </div>
                            )}
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={ticketForm.name}
                                        onChange={e => setTicketForm({ ...ticketForm, name: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                                        placeholder="e.g. Rakesh Kumar"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={ticketForm.email}
                                        onChange={e => setTicketForm({ ...ticketForm, email: e.target.value })}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                                        placeholder="owner@pharmacy.in"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">How can we help?</label>
                                <textarea
                                    rows={5}
                                    required
                                    value={ticketForm.message}
                                    onChange={e => setTicketForm({ ...ticketForm, message: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none placeholder:text-muted-foreground/50"
                                    placeholder="Briefly describe your issue or question..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-primary text-primary-foreground font-bold text-[15px] py-3.5 rounded-lg hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(80,200,120,0.2)] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
                            >
                                {isSubmitting ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Submitting Ticket...</>
                                ) : (
                                    "Submit Ticket"
                                )}
                            </button>
                        </form>
                    )}
                </div>

            </main>

            <Footer />
        </div>
    )
}