"use client";

import { useEffect, useState } from "react";
import { supabase } from "../app/lib/supabase";
import { Loader2, AlertTriangle, Clock, LogOut } from "lucide-react";
import { useRouter, usePathname } from "next/navigation"; // ADDED: usePathname
import Image from "next/image";

export default function ShopGatekeeper({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname(); // ADDED

    useEffect(() => {
        const checkShopAccess = async () => {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    router.push("/login");
                    return;
                }

                // 1. Safely check the tenant table using .maybeSingle()
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('shop_id, role')
                    .eq('id', user.id)
                    .maybeSingle();

                if (userError) throw userError;

                // 2. If no tenant profile found, check the secure Platform Admin vault
                if (!userData) {
                    const { data: platformAdmin } = await supabase
                        .from('platform_admins')
                        .select('role')
                        .eq('id', user.id)
                        .maybeSingle();

                    if (platformAdmin) {
                        router.push("/admin");
                        return;
                    } else {
                        await supabase.auth.signOut();
                        router.push('/login?error=No active profile found.');
                        return;
                    }
                }

                // 3. Fallback for legacy admin setups in the users table
                if (userData.role === "SUPERADMIN" || userData.role === "ADMIN") {
                    router.push("/admin");
                    return;
                }

                // 4. Ensure tenant has a shop assigned
                if (!userData.shop_id) {
                    await supabase.auth.signOut();
                    router.push('/login?error=Invalid account configuration. No shop assigned.');
                    return;
                }

                // --- 5. NEW: REDIS BLACKLIST CHECK (Lightning Fast) ---
                // We check the in-memory cache before hitting the main database
                try {
                    const banRes = await fetch(`/api/auth/check-blacklist?shopId=${userData.shop_id}`);
                    if (banRes.ok) {
                        const banData = await banRes.json();
                        if (banData.isBlacklisted) {
                            console.warn("🛑 Redis Blacklist hit. Revoking access instantly.");
                            await supabase.auth.signOut();
                            router.push('/login?error=Access Revoked: Your pharmacy has been suspended by the platform administrator.');
                            return; // Boot them immediately!
                        }
                    }
                } catch (e) {
                    console.error("Redis blacklist check failed", e);
                }
                // ------------------------------------------------------

                // 6. Verify Shop Status (Supabase Fallback)
                const { data: shopData, error: shopError } = await supabase
                    .from('shops')
                    .select('status')
                    .eq('id', userData.shop_id)
                    .maybeSingle();

                if (shopError) throw shopError;

                // Shop record was physically deleted from database
                if (!shopData) {
                    await supabase.auth.signOut();
                    router.replace("/login?error=account_deleted");
                    return;
                }

                // Only ACTIVE shops are allowed access.
                // Everything else is blocked by default.
                const allowedStatuses = ["ACTIVE"];

                if (!allowedStatuses.includes(shopData.status)) {
                    // These statuses should never access the app:
                    // PENDING
                    // REJECTED
                    // SUSPENDED
                    // PENDING_DELETION
                    // DELETED
                    // Any future unknown status

                    if (
                        shopData.status === "PENDING_DELETION" ||
                        shopData.status === "DELETED"
                    ) {
                        await supabase.auth.signOut();
                        router.replace("/login?error=account_deleted");
                        return;
                    }

                    setStatus(shopData.status);
                    return;
                }

                setStatus("ACTIVE");

            } catch (error) {
                console.error("Gatekeeper error:", error);
                router.push("/login");
            } finally {
                setIsLoading(false);
            }
        };

        checkShopAccess();
    }, [router, pathname]); // ADDED: pathname ensures this runs on every page click

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-muted-foreground transition-colors duration-300">
                <div className="mb-8 relative flex items-center justify-center opacity-70 animate-pulse">
                    <Image src="/Receipt_logo.png" alt="StockEasy Logo" width={180} height={40} className="object-contain block dark:hidden scale-125" priority />
                    <Image src="/StockEasy_logo.png" alt="StockEasy Logo" width={180} height={40} className="object-contain hidden dark:block" priority />
                </div>
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p className="font-mono text-sm uppercase tracking-widest text-primary font-bold">Verifying Integrity...</p>
            </div>
        );
    }

    // TRAP 1: PENDING
    if (status === "PENDING") {
        return (
            <div className="flex h-screen items-center justify-center bg-background p-4 text-center transition-colors duration-300">
                <div className="bg-card border border-border p-10 rounded-2xl max-w-md w-full shadow-sm space-y-6 animate-in zoom-in-95 transition-colors">
                    <div className="w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center mx-auto border border-warning/20 shadow-sm">
                        <Clock className="w-10 h-10 text-warning" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Account Under Review</h1>
                        <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                            Your pharmacy registration is currently pending KYC verification by our administrative team. We will notify you once your account is activated.
                        </p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center justify-center gap-2 w-full py-3 bg-background border border-border text-foreground rounded-xl transition-all duration-200 font-bold shadow-sm cursor-pointer hover:bg-muted/80 hover:border-primary/30 hover:shadow-md active:scale-[0.98]"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </div>
        );
    }

    // TRAP 2: REJECTED or SUSPENDED or DELETED or PENDING_DELETION
    if (
        status === "REJECTED" ||
        status === "SUSPENDED" ||
        status === "DELETED" ||
        status === "PENDING_DELETION"
    ) {
        return (
            <div className="flex h-screen items-center justify-center bg-background p-4 text-center transition-colors duration-300">
                <div className="bg-card border border-border p-10 rounded-2xl max-w-md w-full shadow-sm space-y-6 animate-in zoom-in-95 transition-colors">
                    <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto border border-destructive/20 shadow-sm">
                        <AlertTriangle className="w-10 h-10 text-destructive" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
                        <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                            {
                                status === "PENDING_DELETION"
                                    ? "Your pharmacy account has been scheduled for deletion by the platform administrator."
                                    : status === "DELETED"
                                        ? "Your pharmacy account has been permanently deleted."
                                        : `Your pharmacy access to StockEasy has been ${status.toLowerCase()}.`
                            }
                        </p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center justify-center gap-2 w-full py-3 bg-background border border-border text-foreground rounded-xl transition-all duration-200 font-bold shadow-sm cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 hover:shadow-md active:scale-[0.98]"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}