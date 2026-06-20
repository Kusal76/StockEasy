"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "../lib/supabase";
import {
    LayoutDashboard, Receipt, Pill, PlusSquare, Archive,
    Users, LineChart, Bot, History, Settings
} from "lucide-react";

// Import the functional components
import DashboardHeader from "../../components/DashboardHeader";
import ShopGatekeeper from "../../components/ShopGatekeeper";
import RealtimeAuthGuard from "../../components/RealtimeAuthGuard";
import { ThemeToggle } from "../../components/theme-toggle"; // <-- ADDED THEME TOGGLE

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Fetch the active user and ENFORCE SESSION TIMEOUT
    useEffect(() => {
        const authenticateAndEnforceTimeout = async () => {
            // 1. Grab the active session
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                // If they somehow have no session, boot them
                window.location.href = "/login";
                return;
            }

            setCurrentUserId(session.user.id);

            try {
                // 2. Fetch the global session timeout setting from your database
                // (Using supabase direct fetch assuming your RLS allows reading this row)
                const { data: settings } = await supabase
                    .from('platform_settings')
                    .select('session_timeout_hours')
                    .eq('id', 1)
                    .maybeSingle();

                const timeoutHours = settings?.session_timeout_hours || 12; // Default to 12 if missing

                // 3. Calculate how long they have been logged in
                const lastSignIn = new Date(session.user.last_sign_in_at || session.user.created_at);
                const now = new Date();
                const hoursSinceSignIn = (now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60);

                // 4. The Execution: Kick them out if they overstayed
                if (hoursSinceSignIn >= timeoutHours) {
                    console.warn(`Session expired: Logged in for ${hoursSinceSignIn.toFixed(2)} hours. Limit is ${timeoutHours}.`);
                    await supabase.auth.signOut();

                    // You can optionally pass a URL parameter to show an expiration message on the login screen
                    window.location.href = "/login?expired=true";
                }

            } catch (error) {
                console.error("Failed to enforce session timeout:", error);
            }
        };

        authenticateAndEnforceTimeout();

        // Optional: Set up an interval to check every 5 minutes even if they don't click anything
        const intervalId = setInterval(authenticateAndEnforceTimeout, 5 * 60 * 1000);
        return () => clearInterval(intervalId);

    }, [pathname]); // Adding pathname ensures this runs every time they change pages

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
        // Wrap the entire layout in the Gatekeeper
        <ShopGatekeeper>

            {/* The Invisible Real-Time Security Guard */}
            {currentUserId && <RealtimeAuthGuard currentUserId={currentUserId} />}

            {/* DYNAMIC: bg-background and text-foreground added here */}
            <div className="flex min-h-screen bg-background text-foreground font-sans transition-colors duration-300">

                {/* Sidebar - DYNAMIC: bg-card and border-border */}
                <aside className="w-64 bg-card border-r border-border flex flex-col fixed h-full z-20 transition-colors duration-300 shadow-sm">

                    {/* Logo Section */}
                    <div className="h-20 flex items-center px-6 border-b border-border">
                        {/* LIGHT MODE LOGO */}
                        <Image
                            src="/Receipt_logo.png"
                            alt="StockEasy Logo"
                            width={140}
                            height={30}
                            className="object-contain block dark:hidden"
                            priority
                        />

                        {/* DARK MODE LOGO */}
                        <Image
                            src="/StockEasy_logo.png"
                            alt="StockEasy Logo"
                            width={140}
                            height={32}
                            className="object-contain hidden dark:block"
                            priority
                        />
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${isActive
                                            ? "bg-primary/10 border-l-4 border-primary text-primary" // Active state
                                            : "border-l-4 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground" // Inactive state
                                        }`}
                                >
                                    <item.icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* NEW: Bottom Actions / Theme Toggle */}
                    <div className="p-4 border-t border-border mt-auto flex items-center justify-between bg-muted/30">
                        <span className="text-xs font-semibold text-muted-foreground">Theme</span>
                        <ThemeToggle />
                    </div>
                </aside>

                {/* Main Content Area - DYNAMIC: bg-background */}
                <main className="flex-1 ml-64 flex flex-col min-h-screen relative bg-background transition-colors duration-300">

                    {/* The New Functional Global Header */}
                    <div className="sticky top-0 z-50">
                        <DashboardHeader />
                    </div>

                    {/* Page Content */}
                    <div className="flex-1 p-10 overflow-auto">
                        {children}
                    </div>
                </main>
            </div>
        </ShopGatekeeper>
    );
}