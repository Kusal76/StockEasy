"use client";

import { useEffect, useState } from "react";
import { supabase } from "../app/lib/supabase";
import { Loader2, AlertTriangle, Clock, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ShopGatekeeper({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const checkShopAccess = async () => {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    router.push("/login");
                    return;
                }

                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('shop_id, role')
                    .eq('id', user.id)
                    .single();

                if (userError) throw userError;

                if (userData?.role === "SUPERADMIN" || userData?.role === "ADMIN") {
                    setStatus("ACTIVE");
                    return;
                }

                if (!userData?.shop_id) {
                    await supabase.auth.signOut();
                    router.push('/login?error=Invalid account configuration. No shop assigned.');
                    return;
                }

                const { data: shopData, error: shopError } = await supabase
                    .from('shops')
                    .select('status')
                    .eq('id', userData.shop_id)
                    .single();

                if (shopError) throw shopError;

                setStatus(shopData?.status || "PENDING");

            } catch (error) {
                console.error("Gatekeeper error:", error);
                router.push("/login");
            } finally {
                setIsLoading(false);
            }
        };

        checkShopAccess();
    }, [router]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-muted-foreground transition-colors duration-300">
                <div className="mb-8 relative flex items-center justify-center opacity-70 animate-pulse">
                    {/* LIGHT MODE LOGO */}
                    <Image src="/Receipt_logo.png" alt="StockEasy Logo" width={180} height={40} className="object-contain block dark:hidden scale-125" priority />
                    {/* DARK MODE LOGO */}
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

    // TRAP 2: REJECTED or SUSPENDED
    if (status === "REJECTED" || status === "SUSPENDED") {
        return (
            <div className="flex h-screen items-center justify-center bg-background p-4 text-center transition-colors duration-300">
                <div className="bg-card border border-border p-10 rounded-2xl max-w-md w-full shadow-sm space-y-6 animate-in zoom-in-95 transition-colors">
                    <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto border border-destructive/20 shadow-sm">
                        <AlertTriangle className="w-10 h-10 text-destructive" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
                        <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                            Your pharmacy access to StockEasy has been {status.toLowerCase()}. Please contact platform support to resolve this issue and restore your access.
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