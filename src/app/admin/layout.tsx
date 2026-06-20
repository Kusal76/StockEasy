"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { ThemeToggle } from "../../components/theme-toggle"; // <-- IMPORTED TOGGLE HERE
import {
    LayoutDashboard,
    ClipboardCheck,
    Store,
    LineChart,
    Settings,
    LogOut,
    User,
    ShieldAlert,
    MessageSquare
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [adminEmail, setAdminEmail] = useState<string>("Loading...");

    // Fetch the actual admin's email for the profile dropdown
    useEffect(() => {
        const fetchAdminProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                setAdminEmail(user.email);
            }
        };
        fetchAdminProfile();
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    // Added the Support Inbox to the navigation array
    const navItems = [
        { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { name: "Verification", href: "/admin/verification", icon: ClipboardCheck },
        { name: "Shops", href: "/admin/shops", icon: Store },
        { name: "Analytics", href: "/admin/analytics", icon: LineChart },
        { name: "Support Inbox", href: "/admin/support", icon: MessageSquare },
        { name: "Global Settings", href: "/admin/settings", icon: Settings },
    ];

    return (
        <div className="flex min-h-screen bg-background text-foreground font-sans transition-colors duration-300">

            {/* Sidebar */}
            <aside className="w-64 bg-card border-r border-border flex flex-col fixed h-full z-20 transition-colors duration-300">

                {/* Left Side Logo Area */}
                <div className="h-20 flex items-center px-6 border-b border-border">
                    {/* LIGHT MODE LOGO (Hidden in dark mode) */}
                    <Image
                        src="/Receipt_logo.png"
                        alt="StockEasy Logo"
                        width={155}
                        height={32}
                        className="object-contain block dark:hidden"
                        priority
                    />

                    {/* DARK MODE LOGO (Hidden in light mode) */}
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
                <nav className="flex-1 py-6 flex flex-col gap-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${isActive
                                    ? "bg-muted border-l-4 border-primary text-foreground"
                                    : "border-l-4 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                            >
                                <item.icon className="w-4 h-4" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 ml-64 flex flex-col min-h-screen relative">

                {/* Top Header Bar */}
                <header className="h-20 border-b border-border bg-background/95 backdrop-blur-md flex items-center justify-between px-10 sticky top-0 z-10 transition-colors duration-300">

                    {/* Page Title */}
                    <h1 className="text-xl font-semibold text-foreground capitalize">
                        {pathname === '/admin' ? 'Central Dashboard' : pathname.split('/').pop()?.replace('-', ' ')}
                    </h1>

                    {/* Right Side: Theme Toggle & Admin Profile */}
                    <div className="flex items-center gap-6">

                        {/* THEME TOGGLE ADDED HERE */}
                        <ThemeToggle />

                        <div className="relative">
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                onBlur={() => setTimeout(() => setIsProfileOpen(false), 200)} // Auto-close when clicking away
                                className="relative group flex items-center focus:outline-none cursor-pointer"
                            >
                                {/* Tooltip */}
                                <span className="absolute top-14 left-1/2 -translate-x-1/2 bg-card border border-border text-xs font-medium text-foreground px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg pointer-events-none z-50">
                                    System Admin
                                </span>

                                {/* Avatar Graphic */}
                                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/20 hover:border-primary/50 transition-all shadow-sm">
                                    <User className="w-5 h-5" />
                                </div>
                            </button>

                            {/* Dropdown Menu */}
                            {isProfileOpen && (
                                <div className="absolute right-0 mt-4 w-60 bg-card border border-border rounded-xl shadow-2xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">

                                    {/* Name & Email Section */}
                                    <div className="px-5 py-4 border-b border-border bg-muted/30">
                                        <p className="text-sm font-bold text-foreground flex items-center gap-2">
                                            Level 4 Admin <ShieldAlert className="w-3 h-3 text-destructive" />
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1 truncate">{adminEmail}</p>
                                    </div>

                                    {/* Menu Actions */}
                                    <div className="p-2 space-y-1">

                                        <button
                                            onClick={() => router.push("/admin/settings")}
                                            className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                                        >
                                            <Settings className="w-4 h-4" /> Global Settings
                                        </button>
                                        <div className="h-px bg-border my-1"></div>
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                                        >
                                            <LogOut className="w-4 h-4" /> Secure Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content injected here */}
                <div className="flex-1 p-10 overflow-auto">
                    {children}
                </div>
            </main>

        </div>
    );
}