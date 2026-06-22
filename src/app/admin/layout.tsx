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
    X,
    Loader2
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [adminEmail, setAdminEmail] = useState<string>("Loading...");
    const [userRole, setUserRole] = useState<string>("admin");

    const [isVerifying, setIsVerifying] = useState(true);

    useEffect(() => {
        const fetchAdminProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            if (user?.email) {
                setAdminEmail(user.email);

                // 1. FIRST CHECK: The Secure Platform Admins Vault
                const { data: platformAdmin } = await supabase
                    .from("platform_admins")
                    // ADDED: requires_password_change
                    .select("role, requires_password_change")
                    .eq("id", user.id)
                    .maybeSingle();

                if (platformAdmin) {
                    // THE FIX: Catch the password reset here in the layout!
                    if (platformAdmin.requires_password_change && pathname !== "/admin/setup-password") {
                        router.push("/admin/setup-password");
                        // Return early WITHOUT setting isVerifying to false. 
                        // This keeps the loading spinner active during the redirect (No flash!)
                        return;
                    }

                    setUserRole(platformAdmin.role.toUpperCase());
                    setIsVerifying(false);
                    return;
                }

                // 2. SECOND CHECK: Fallback to the generic users table 
                const { data: tenantAdmin, error: tenantError } = await supabase
                    .from("users")
                    .select("role")
                    .eq("id", user.id)
                    .maybeSingle();

                if (tenantError) {
                    console.error("Admin Layout Error:", tenantError);
                }

                const role = tenantAdmin?.role?.toUpperCase();

                if (tenantAdmin && (role === "SUPERADMIN" || role === "ADMIN")) {
                    setUserRole(role);
                    setIsVerifying(false);
                    return;
                }

                // 3. THE KICK-OUT: If they fail BOTH checks, they are not an admin.
                console.warn("User failed admin check. (Redirect Disabled for debugging)");
                router.push("/dashboard");
            }
        };
        fetchAdminProfile();
    }, [router, pathname]);

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const baseNavItems = [
        { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { name: "Verification", href: "/admin/verification", icon: ClipboardCheck },
        { name: "Shops", href: "/admin/shops", icon: Store },
        { name: "Analytics", href: "/admin/analytics", icon: LineChart },
        { name: "Support Inbox", href: "/admin/support", icon: MessageSquare },
    ];

    const navItems = userRole === "SUPERADMIN"
        ? [...baseNavItems, { name: "Global Settings", href: "/admin/settings", icon: Settings }]
        : baseNavItems;

    if (isVerifying) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-muted-foreground transition-colors duration-300">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p className="font-mono text-sm uppercase tracking-widest text-primary font-bold">Authenticating Clearance...</p>
            </div>
        );
    }

    // THE FIX: If they are on the setup-password page, do NOT render the sidebar or header wrappers.
    // Just render the bare children.
    if (pathname === "/admin/setup-password") {
        return (
            <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
                {children}
            </div>
        );
    }

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

                    {/* STRICT SUPER ADMIN CONDITIONAL RENDER */}
                    {userRole === "SUPERADMIN" && (
                        <div className="pt-6 mt-6 border-t border-border">
                            <p className="px-6 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                System Control
                            </p>
                            <Link
                                href="/admin/super-admin"
                                className={`flex items-center gap-3 px-6 py-3 text-sm font-bold transition-colors cursor-pointer ${pathname === "/admin/super-admin"
                                    ? "bg-destructive/10 border-l-4 border-destructive text-destructive"
                                    : "border-l-4 border-transparent text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                                    }`}
                            >
                                <ShieldAlert className="w-4 h-4" />
                                Super Admin
                            </Link>
                        </div>
                    )}
                </nav>
            </aside>

            {/* Main Content Area */}
            {/* 1. Change min-h-screen to h-[100dvh] overflow-hidden so the page itself cannot scroll */}
            <main className="flex-1 ml-0 md:ml-64 flex flex-col h-[100dvh] overflow-hidden relative w-full">

                {/* Top Header Bar */}
                {/* 2. Removed sticky top-0 since the flex-col handles the layout natively now */}
                <header className="h-16 md:h-20 border-b border-border bg-background/95 flex items-center justify-between px-4 md:px-10 z-30 transition-colors duration-300 shadow-sm md:shadow-none shrink-0">

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
                                    {userRole === "SUPERADMIN" ? "CTO / Super Admin" : "System Admin"}
                                </span>

                                {/* Avatar Graphic */}
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${userRole === "SUPERADMIN"
                                    ? "bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 hover:border-destructive/50"
                                    : "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50"
                                    }`}>
                                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                            </button>

                            {/* Dropdown Menu */}
                            {isProfileOpen && (
                                <div className="absolute right-0 mt-3 sm:mt-4 w-56 sm:w-60 bg-card border border-border rounded-xl shadow-2xl overflow-hidden py-1 sm:py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">

                                    {/* Name & Email Section */}
                                    <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border bg-muted/30">
                                        <p className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                                            {userRole === "SUPERADMIN" ? "Level 4 Admin" : "Level 1 Admin"}
                                            {userRole === "SUPERADMIN" && <ShieldAlert className="w-3 h-3 text-destructive" />}
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
                {/* 3. Make ONLY this container scrollable */}
                <div className="flex-1 p-4 sm:p-6 md:p-10 overflow-y-auto custom-scrollbar w-full">
                    {children}
                </div>
            </main>
            
        </div>
    );
}