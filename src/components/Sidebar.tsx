"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ShoppingCart,
    PackagePlus,
    Settings,
    Users,
    Pill,
    LogOut,
    Activity,
    Bot
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { supabase } from "../app/lib/supabase";

export default function Sidebar() {
    const pathname = usePathname();
    const [userRole, setUserRole] = useState<string>("STAFF");

    useEffect(() => {
        const fetchRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: staffData } = await supabase.from('staff_profiles').select('role').eq('id', user.id).maybeSingle();

                if (staffData) {
                    setUserRole("STAFF");
                    return;
                }

                const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
                if (data?.role) {
                    setUserRole(data.role.toUpperCase());
                }
            }
        };
        fetchRole();
    }, []);

    let NAV_ITEMS = [
        { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
        { name: "Point of Sale", href: "/dashboard/sell", icon: ShoppingCart },
        { name: "Stock Entry", href: "/dashboard/stock-entry", icon: PackagePlus },
        { name: "Inventory", href: "/dashboard/inventory", icon: Pill },
    ];

    if (userRole === "OWNER" || userRole === "ADMIN" || userRole === "SUPERADMIN") {
        NAV_ITEMS.push({ name: "Staff Mgmt", href: "/dashboard/staff", icon: Users });
        NAV_ITEMS.push({ name: "Analytics", href: "/dashboard/analytics", icon: Activity });
        NAV_ITEMS.push({ name: "AI Assistant", href: "/dashboard/ai", icon: Bot });
    }

    NAV_ITEMS.push({ name: "Settings", href: "/dashboard/settings", icon: Settings });

    return (
        <aside className="hidden md:flex w-64 h-screen bg-card border-r border-border flex-col transition-colors duration-300 z-50 shadow-sm relative">

            {/* Header / Logo Section */}
            <div className="h-16 flex items-center px-6 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/20">
                        <Pill className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <span className="text-xl font-extrabold text-foreground tracking-tight">Stock<span className="text-primary">Easy</span></span>
                </div>
            </div>

            {/* Main Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all group relative ${isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                            )}
                            <item.icon className={`w-4 h-4 transition-colors ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                }`} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Profile & Actions Section */}
            <div className="p-4 border-t border-border bg-muted/10">
                <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-foreground tracking-wide uppercase">{userRole}</span>
                        <span className="text-[11px] text-muted-foreground mt-0.5 font-medium">Session Active</span>
                    </div>
                    <ThemeToggle />
                </div>

                <button
                    onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors border border-transparent hover:border-destructive/20 cursor-pointer shadow-sm"
                >
                    <LogOut className="w-4 h-4" />
                    Secure Logout
                </button>
            </div>
        </aside>
    );
}