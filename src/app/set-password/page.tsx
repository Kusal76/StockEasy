"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { ShieldCheck, Loader2, Lock, AlertTriangle } from "lucide-react";

export default function SetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [authError, setAuthError] = useState("");

    useEffect(() => {
        let isMounted = true;

        const forceSessionInjection = async () => {
            try {
                // 1. MANUALLY INTERCEPT TOKENS FROM THE TERMINAL LINK
                const hash = window.location.hash;
                if (hash && hash.includes('access_token')) {
                    const params = new URLSearchParams(hash.substring(1));
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    if (accessToken && refreshToken) {
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken
                        });

                        if (error) throw error;

                        // Clear the URL hash so it doesn't loop
                        window.history.replaceState(null, '', window.location.pathname);
                        if (isMounted) setIsCheckingAuth(false);
                        return;
                    }
                }

                // 2. Fallback check for an existing session
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    if (isMounted) setIsCheckingAuth(false);
                    return;
                }

                // 3. No tokens in URL and no session -> Kick to login
                if (isMounted) router.push('/login');

            } catch (err: any) {
                if (isMounted) {
                    setAuthError(err.message || "Failed to secure session.");
                    setIsCheckingAuth(false);
                }
            }
        };

        forceSessionInjection();

        return () => { isMounted = false; };
    }, [router]);

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 8) return setErrorMsg("Password must be at least 8 characters.");

        setIsSaving(true);
        setErrorMsg("");

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password: password });
            if (updateError) throw updateError;

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('staff_profiles').update({ status: 'ACTIVE' }).eq('id', user.id);
            }

            router.push('/dashboard');
        } catch (error: any) {
            setErrorMsg(error.message || "Failed to secure account.");
            setIsSaving(false);
        }
    };

    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center transition-colors duration-300">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest font-bold">Securing Token...</p>
            </div>
        );
    }

    if (authError) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4 transition-colors duration-300">
                <div className="w-full max-w-md bg-card border border-destructive/50 rounded-2xl shadow-xl p-8 text-center animate-in zoom-in-95 duration-500">
                    <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-foreground mb-2">Authentication Failed</h1>
                    <p className="text-destructive/90 text-sm mb-6 font-medium">{authError}</p>
                    <button onClick={() => router.push('/login')} className="w-full bg-background border border-border text-foreground font-bold py-3 rounded-xl hover:bg-muted cursor-pointer transition-colors shadow-sm">
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 transition-colors duration-300 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 animate-in zoom-in-95 duration-500 relative z-10 transition-colors">
                <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground text-center mb-2">Secure Your Account</h1>
                <p className="text-muted-foreground text-sm font-medium text-center mb-8">Welcome to the team. Please set a permanent password for your staff account.</p>

                <form onSubmit={handleSetPassword} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">New Password</label>
                        <div className="relative group">
                            <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-background border border-border rounded-xl pl-11 pr-4 py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm"
                                placeholder="Min 8 characters"
                            />
                        </div>
                    </div>

                    {errorMsg && <p className="text-destructive text-sm font-bold text-center">{errorMsg}</p>}

                    <button type="submit" disabled={isSaving || !password} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-sm">
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save & Enter Dashboard"}
                    </button>
                </form>
            </div>
        </div>
    );
}