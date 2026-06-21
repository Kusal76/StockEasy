"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { ThemeToggle } from "../../components/theme-toggle";
import {
    LayoutDashboard,
    ClipboardCheck,
    Store,
    LineChart,
    Settings,
    LogOut,
    User,
    ShieldAlert,
    MessageSquare,
    Menu,
    X
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

    // Auto-close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const navItems = [
        { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { name: "Verification", href: "/admin/verification", icon: ClipboardCheck },
        { name: "Shops", href: "/admin/shops", icon: Store },
        { name: "Analytics", href: "/admin/analytics", icon: LineChart },
        { name: "Support Inbox", href: "/admin/support", icon: MessageSquare },
        { name: "Global Settings", href: "/admin/settings", icon: Settings },
    ];

    return (
        <div className="flex min-h-screen bg-background text-foreground font-sans transition-colors duration-300 overflow-x-hidden">

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 h-full w-64 bg-card border-r border-border flex flex-col z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
            >
                {/* Left Side Logo Area */}
                <div className="h-16 md:h-20 flex items-center justify-between px-6 border-b border-border shrink-0">
                    {/* FIX: Changed cursor-pointer to cursor-default for the arrow cursor */}
                    <Link href="/admin" className="block cursor-default">
                        {/* LIGHT MODE LOGO */}
                        <Image
                            src="/Receipt_logo.png"
                            alt="StockEasy Logo"
                            width={130}
                            height={32}
                            className="object-contain block dark:hidden origin-left"
                            priority
                        />
                        {/* DARK MODE LOGO */}
                        <Image
                            src="/StockEasy_logo.png"
                            alt="StockEasy Logo"
                            width={130}
                            height={32}
                            className="object-contain hidden dark:block origin-left"
                            priority
                        />
                    </Link>

                    {/* Mobile Close Button */}
                    <button
                        className="md:hidden text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-6 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${isActive
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
            <main className="flex-1 ml-0 md:ml-64 flex flex-col min-h-screen relative w-full">

                {/* Top Header Bar */}
                <header className="h-16 md:h-20 border-b border-border bg-background/95 backdrop-blur-md flex items-center justify-between px-4 md:px-10 sticky top-0 z-30 transition-colors duration-300 shadow-sm md:shadow-none">

                    {/* Page Title & Mobile Toggle */}
                    <div className="flex items-center gap-3">
                        <button
                            className="md:hidden p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <h1 className="text-lg md:text-xl font-semibold text-foreground capitalize truncate max-w-[150px] sm:max-w-xs md:max-w-none">
                            {pathname === '/admin' ? 'Central Dashboard' : pathname.split('/').pop()?.replace('-', ' ')}
                        </h1>
                    </div>

                    {/* Right Side: Theme Toggle & Admin Profile */}
                    <div className="flex items-center gap-2 sm:gap-6">

                        <ThemeToggle />

                        <div className="relative">
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                onBlur={() => setTimeout(() => setIsProfileOpen(false), 200)}
                                className="relative group flex items-center focus:outline-none cursor-pointer pl-1 sm:pl-0"
                            >
                                {/* Tooltip - Hidden on mobile */}
                                <span className="hidden md:block absolute top-14 left-1/2 -translate-x-1/2 bg-card border border-border text-xs font-medium text-foreground px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg pointer-events-none z-50">
                                    System Admin
                                </span>

                                {/* Avatar Graphic */}
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/20 hover:border-primary/50 transition-all shadow-sm">
                                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                            </button>

                            {/* Dropdown Menu */}
                            {isProfileOpen && (
                                <div className="absolute right-0 mt-3 sm:mt-4 w-56 sm:w-60 bg-card border border-border rounded-xl shadow-2xl overflow-hidden py-1 sm:py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">

                                    {/* Name & Email Section */}
                                    <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border bg-muted/30">
                                        <p className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                                            Level 4 Admin <ShieldAlert className="w-3 h-3 text-destructive" />
                                        </p>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{adminEmail}</p>
                                    </div>

                                    {/* Menu Actions */}
                                    <div className="p-1.5 sm:p-2 space-y-1">
                                        <button
                                            onClick={() => router.push("/admin/settings")}
                                            className="w-full text-left flex items-center gap-2 px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                                        >
                                            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Global Settings
                                        </button>
                                        <div className="h-px bg-border my-1"></div>
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full text-left flex items-center gap-2 px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                                        >
                                            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Secure Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 p-4 sm:p-6 md:p-10 overflow-auto w-full">
                    {children}
                </div>
            </main>

        </div>
    );
}