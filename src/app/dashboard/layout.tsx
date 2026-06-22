"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "../lib/supabase";
import {
    LayoutDashboard, Receipt, Pill, PlusSquare, Archive,
    Users, LineChart, Bot, History, Settings, Menu, X
} from "lucide-react";

// Import the functional components
import DashboardHeader from "../../components/DashboardHeader";
import ShopGatekeeper from "../../components/ShopGatekeeper";
import RealtimeAuthGuard from "../../components/RealtimeAuthGuard";
import { ThemeToggle } from "../../components/theme-toggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // --- NEW: Mobile Menu State ---
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Fetch the active user and ENFORCE SESSION TIMEOUT
    useEffect(() => {
        const authenticateAndEnforceTimeout = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                window.location.href = "/login";
                return;
            }

            setCurrentUserId(session.user.id);

            try {
                const { data: settings } = await supabase
                    .from('platform_settings')
                    .select('session_timeout_hours')
                    .eq('id', 1)
                    .maybeSingle();

                const timeoutHours = settings?.session_timeout_hours || 12;

                const lastSignIn = new Date(session.user.last_sign_in_at || session.user.created_at);
                const now = new Date();
                const hoursSinceSignIn = (now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60);

                if (hoursSinceSignIn >= timeoutHours) {
                    console.warn(`Session expired: Logged in for ${hoursSinceSignIn.toFixed(2)} hours. Limit is ${timeoutHours}.`);
                    await supabase.auth.signOut();
                    window.location.href = "/login?expired=true";
                }

            } catch (error) {
                console.error("Failed to enforce session timeout:", error);
            }
        };

        authenticateAndEnforceTimeout();

        const intervalId = setInterval(authenticateAndEnforceTimeout, 5 * 60 * 1000);
        return () => clearInterval(intervalId);

    }, [pathname]);

    // --- NEW: Close mobile menu automatically when navigating to a new page ---
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    const navItems = [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Sell / Bill", href: "/dashboard/sell", icon: Receipt },
        { name: "Medicines", href: "/dashboard/medicines", icon: Pill },
        { name: "Stock Entry", href: "/dashboard/stock-entry", icon: PlusSquare },
        { name: "Inventory", href: "/dashboard/inventory", icon: Archive },
        { name: "Dealers", href: "/dashboard/dealers", icon: Users },
        { name: "Analytics", href: "/dashboard/analytics", icon: LineChart },
        { name: "AI Assistant", href: "/dashboard/ai", icon: Bot },
        { name: "Bills History", href: "/dashboard/history", icon: History },
        { name: "Settings", href: "/dashboard/settings", icon: Settings },
    ];

    return (
        <ShopGatekeeper>

            {currentUserId && <RealtimeAuthGuard currentUserId={currentUserId} />}

            <div className="flex min-h-screen bg-background text-foreground font-sans transition-colors duration-300 relative overflow-x-hidden">

                {/* --- NEW: Mobile Overlay Backdrop --- */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}

                {/* Sidebar - DYNAMIC RESPONSIVE (Off-Canvas on Mobile) */}
                <aside className={`fixed inset-y-0 left-0 w-64 bg-card border-r border-border flex flex-col h-full z-50 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-sm md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>

                    <div className="h-20 flex items-center justify-between px-6 border-b border-border">
                        <div className="flex items-center">
                            <Image
                                src="/Receipt_logo.png"
                                alt="StockEasy Logo"
                                width={140}
                                height={30}
                                className="object-contain block dark:hidden"
                                priority
                            />
                            <Image
                                src="/StockEasy_logo.png"
                                alt="StockEasy Logo"
                                width={140}
                                height={32}
                                className="object-contain hidden dark:block"
                                priority
                            />
                        </div>
                        {/* --- NEW: Mobile Close Button --- */}
                        <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-muted-foreground hover:text-foreground">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${isActive
                                        ? "bg-primary/10 border-l-4 border-primary text-primary"
                                        : "border-l-4 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                                        }`}
                                >
                                    <item.icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-border mt-auto flex items-center justify-between bg-muted/30">
                        <span className="text-xs font-semibold text-muted-foreground">Theme</span>
                        <ThemeToggle />
                    </div>
                </aside>

                {/* Main Content Area - RESPONSIVE MARGINS */}
                {/* 1. Added h-[100dvh] and overflow-hidden to lock the page frame */}
                <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative bg-background transition-colors duration-300 w-full md:ml-64">

                    {/* 2. Removed sticky/top-0. flex-col will naturally keep this at the top */}
                    <div className="z-30 shrink-0">
                        <DashboardHeader />
                    </div>

                    {/* RESPONSIVE PADDING (p-4 for mobile, p-10 for desktop) */}
                    {/* 3. Added overflow-y-auto and custom-scrollbar to make ONLY this area scrollable */}
                    <div className="flex-1 p-4 md:p-10 overflow-y-auto overflow-x-hidden custom-scrollbar">
                        {children}
                    </div>
                </main>

                {/* --- NEW: Floating Mobile Menu Button --- */}
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="md:hidden fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground p-4 rounded-full shadow-xl hover:bg-primary/90 transition-transform active:scale-95"
                    title="Open Menu"
                >
                    <Menu className="w-6 h-6" />
                </button>

            </div>
        </ShopGatekeeper>
    );
}