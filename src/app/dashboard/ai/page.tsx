"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { Bot, Send, User, Loader2, ShieldAlert, RefreshCw, Zap, Ban, Lock } from "lucide-react";

interface ChatMessage {
    id: string;
    role: "user" | "ai";
    content: string;
}

export default function AIAssistantPage() {
    const router = useRouter();

    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: "1", role: "ai", content: "Hello! I am your StockEasy AI Manager. I am analyzing your live inventory, dealers, and recent sales. How can I help you today?" }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    const [shopContext, setShopContext] = useState<string>("Loading context...");
    const [isRefreshingContext, setIsRefreshingContext] = useState(false);

    // --- FEATURE GATING STATES ---
    const [isAuthorizing, setIsAuthorizing] = useState(true);
    const [shopPlan, setShopPlan] = useState<string>("STARTER");

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const QUICK_PROMPTS = [
        "What items are expiring in the next 30 days?",
        "Summarize my recent sales and revenue.",
        "Which medicines are low on stock?",
        "List my active dealers and suppliers."
    ];

    // Auto-scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    // Check Plan on Mount
    useEffect(() => {
        checkAuthAndLoad();
    }, []);

    // 1. ADD THESE STATES AT THE TOP OF AIAssistantPage
    const [isStaff, setIsStaff] = useState(false);
    const [userEmail, setUserEmail] = useState("");

    // 2. REPLACE checkAuthAndLoad WITH THIS
    const checkAuthAndLoad = async () => {
        setIsAuthorizing(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setUserEmail(user.email || "");

            // 1. HARD BLOCK: Check if they are in the staff table
            const { data: staffProfile } = await supabase.from('staff_profiles').select('id').eq('id', user.id).maybeSingle();
            if (staffProfile) {
                setIsStaff(true);
                return;
            }

            // Fetch the role alongside the shop_id (fallback check)
            const { data: userData } = await supabase.from('users').select('shop_id, role').eq('id', user.id).single();
            if (!userData?.shop_id) return;

            if (userData.role?.toUpperCase() === "STAFF") {
                setIsStaff(true);
                return;
            }

            // Fetch the current plan securely
            const { data: shopData } = await supabase.from('shops').select('plan').eq('id', userData.shop_id).single();
            const currentPlan = shopData?.plan?.toUpperCase() || "STARTER";
            setShopPlan(currentPlan);

            // ONLY load the heavy AI context if they are a paying PRO user
            if (currentPlan === "PRO") {
                await buildShopContext(userData.shop_id);
            }
        } catch (error) {
            console.error("Authorization check failed:", error);
        } finally {
            setIsAuthorizing(false);
        }
    };

    // 3. ADD THIS RENDER BLOCK RIGHT AFTER `if (isAuthorizing) { return (...) }`
    // --- RESTRICTED ACCESS SCREEN FOR STAFF ---
    if (isStaff) {
        return (
            <div className="max-w-2xl mx-auto mt-20 animate-in fade-in duration-500 transition-colors duration-300">
                <div className="bg-card border border-destructive/30 rounded-2xl shadow-xl p-10 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-destructive to-transparent opacity-50"></div>
                    <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6 border border-destructive/20 shadow-sm">
                        <Ban className="w-10 h-10 text-destructive" />
                    </div>
                    <h1 className="text-3xl font-bold text-foreground mb-3">Access Restricted</h1>
                    <p className="text-muted-foreground mb-6 max-w-md leading-relaxed font-medium">
                        Your account is provisioned with <strong>Staff</strong> privileges. The StockEasy AI Assistant and live predictive insights are strictly restricted to the Shop Owner.
                    </p>
                    <div className="px-6 py-3 bg-secondary border border-border rounded-xl text-sm font-mono text-muted-foreground shadow-sm">
                        Logged in as: <span className="text-foreground font-bold">{userEmail}</span>
                    </div>
                </div>
            </div>
        );
    }

    // --- UPGRADED: COMPREHENSIVE DATA CONTEXT BUILDER ---
    const buildShopContext = async (providedShopId?: string) => {
        setIsRefreshingContext(true);
        try {
            let activeShopId = providedShopId;

            // If called from the Refresh button, we need to fetch the ID again
            if (!activeShopId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data: userData } = await supabase.from('users').select('shop_id').eq('id', user.id).single();
                activeShopId = userData?.shop_id;
            }

            if (!activeShopId) return;

            // Run multiple queries in parallel for speed
            const [
                { data: inventory },
                { data: bills },
                { data: dealers },
                { data: shopSettings }
            ] = await Promise.all([
                // 1. Fetch entire inventory (ordered by expiry for FEFO analysis)
                supabase.from('inventory').select('*').eq('shop_id', activeShopId).order('expiry_date', { ascending: true }),
                // 2. Fetch recent bills & items
                supabase.from('bills').select('*, bill_items(*)').eq('shop_id', activeShopId).order('created_at', { ascending: false }).limit(30),
                // 3. Fetch dealers
                supabase.from('dealers').select('*').eq('shop_id', activeShopId),
                // 4. Fetch shop settings/profile
                supabase.from('shops').select('name, business_type, plan, status').eq('id', activeShopId).single()
            ]);

            // Calculate quick analytics for the AI
            const totalRevenue = (bills || []).reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
            const totalInventoryItems = (inventory || []).length;
            const lowStockItems = (inventory || []).filter(i => Number(i.quantity) < 10).length;

            // Compile massive context string
            let contextStr = `
                PHARMACY DATA SNAPSHOT (Generated: ${new Date().toLocaleString()}):
                
                --- SHOP PROFILE & SETTINGS ---
                Name: ${shopSettings?.name || 'Unknown'}
                Business Type: ${shopSettings?.business_type || 'N/A'}
                Subscription Plan: ${shopSettings?.plan || 'N/A'}
                System Status: ${shopSettings?.status || 'N/A'}

                --- LIVE ANALYTICS ---
                Total Revenue (from last 30 bills): ₹${totalRevenue.toFixed(2)}
                Unique Catalog Items: ${totalInventoryItems}
                Items dangerously low on stock (< 10 units): ${lowStockItems}

                --- LIVE INVENTORY (FEFO ORDER) ---
                ${inventory?.map(i => `- ${i.medicine_name} | Qty: ${i.quantity} | MRP: ₹${i.mrp} | Batch: ${i.batch_number || 'N/A'} | Expiry: ${i.expiry_date} | Dealer: ${i.dealer_name || 'N/A'}`).join('\n') || "No inventory records found."}

                --- ACTIVE DEALERS / SUPPLIERS ---
                ${dealers?.map(d => `- ${d.name} | Contact: ${d.contact_number || 'N/A'} | Email: ${d.email || 'N/A'}`).join('\n') || "No dealers registered."}

                --- RECENT SALES HISTORY ---
                ${bills?.map(b => {
                const itemsList = (b.bill_items || []).map((it: any) => `${it.medicine_name} (x${it.quantity})`).join(', ');
                return `- Date: ${new Date(b.created_at).toLocaleString()} | Customer: ${b.customer_name || 'Walk-in'} | Total: ₹${b.total_amount} | Method: ${b.payment_method} | Items: [${itemsList || 'None'}]`;
            }).join('\n') || "No recent billing history."}
            `;

            setShopContext(contextStr);
        } catch (error) {
            console.error("Failed to build context:", error);
            setShopContext("Could not load database context due to a system error.");
        } finally {
            setIsRefreshingContext(false);
        }
    };

    const handleSendMessage = async (e?: React.FormEvent, overrideText?: string) => {
        if (e) e.preventDefault();

        const textToSend = overrideText || input;
        if (!textToSend.trim() || isTyping) return;

        const userMsg = textToSend.trim();
        setInput("");

        // Add user message to UI
        const newUserMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: userMsg };
        setMessages(prev => [...prev, newUserMsg]);
        setIsTyping(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg, shopContext })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || "Failed to fetch response.");

            // Add AI response to UI
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "ai", content: data.text }]);
        } catch (error: any) {
            console.error("Chat Error:", error);
            // Show the professional error message returned by our backend
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "ai",
                content: error.message || "The AI Analytics engine is currently processing a high volume of requests. Please try your query again in a few moments."
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    // --- Loading State ---
    if (isAuthorizing) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-muted-foreground transition-colors duration-300">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p className="font-mono text-sm tracking-widest uppercase font-bold">Verifying Authorization...</p>
            </div>
        );
    }

    // --- GATED ACCESS SCREEN ---
    if (shopPlan !== "PRO") {
        return (
            <div className="max-w-2xl mx-auto mt-20 animate-in fade-in duration-500 transition-colors duration-300">
                <div className="bg-card border border-primary/30 rounded-2xl shadow-xl p-10 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20 shadow-sm">
                        <Lock className="w-10 h-10 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold text-foreground mb-3">Pro Feature Locked</h1>
                    <p className="text-muted-foreground mb-8 leading-relaxed max-w-md font-medium">
                        The StockEasy AI Assistant and Predictive Demand Engine require significant computing power. Please upgrade to the <strong>Pro Plan</strong> to unlock this enterprise feature.
                    </p>
                    <button
                        onClick={() => router.push('/dashboard/settings')}
                        className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
                    >
                        Upgrade to Pro
                    </button>
                </div>
            </div>
        );
    }

    // --- FULL AI ASSISTANT (PRO ONLY) ---
    return (
        <div className="max-w-5xl mx-auto animate-in fade-in duration-500 h-[calc(100vh-120px)] flex flex-col relative pb-8 transition-colors duration-300">

            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">StockEasy AI Assistant</h1>
                        <p className="text-muted-foreground text-sm font-medium">Powered by Google Gemini Enterprise</p>
                    </div>
                </div>

                <button
                    onClick={() => buildShopContext()}
                    disabled={isRefreshingContext}
                    className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                    title="Pull latest live data from database"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingContext ? 'animate-spin text-primary' : ''}`} />
                    {isRefreshingContext ? 'Syncing...' : 'Sync Live DB'}
                </button>
            </div>

            {/* Chat Container */}
            <div className="flex-1 bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden relative transition-colors duration-300">

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${msg.role === 'user' ? 'bg-muted text-foreground border border-border' : 'bg-primary/10 border border-primary/20 text-primary'}`}>
                                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                            </div>

                            <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-primary text-primary-foreground font-bold rounded-tr-sm shadow-sm'
                                : 'bg-background border border-border text-foreground font-medium rounded-tl-sm whitespace-pre-wrap shadow-sm'
                                }`}>
                                {/* Frontend markdown stripper to guarantee clean SaaS text output */}
                                {msg.content.replace(/\*\*/g, '')}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 mt-1 shadow-sm">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div className="bg-background border border-border rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2 shadow-sm">
                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-muted/20 border-t border-border">

                    {messages.length < 3 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {QUICK_PROMPTS.map((prompt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSendMessage(undefined, prompt)}
                                    disabled={isTyping || isRefreshingContext}
                                    className="flex items-center gap-1.5 text-[11px] font-bold bg-background border border-primary/30 text-primary px-3 py-1.5 rounded-full hover:bg-primary/10 hover:border-primary/50 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                                >
                                    <Zap className="w-3 h-3" /> {prompt}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="bg-background border border-border rounded-lg p-3 mb-4 flex items-start gap-3 shadow-sm">
                        <ShieldAlert className="w-4 h-4 text-info mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground font-medium">AI responses are generated based on your current live database context. Verify important clinical data manually.</p>
                    </div>

                    <form onSubmit={handleSendMessage} className="relative flex items-center">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isRefreshingContext ? "Syncing database..." : "Ask about inventory, sales, or expiring items..."}
                            className="w-full bg-background border border-border rounded-xl pl-4 pr-14 py-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm font-medium disabled:opacity-50"
                            disabled={isTyping || isRefreshingContext}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isTyping || isRefreshingContext}
                            className="absolute right-2 p-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                        >
                            {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
}