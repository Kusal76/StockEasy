"use client";

import { useState, useEffect } from "react";
import { Lock, EyeOff, Eye, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function UpdatePasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        // The server already set our cookies! We just instantly check if they exist.
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setErrorMsg("No active secure session found. Please request a new password reset link.");
            }
            setIsChecking(false);
        };

        checkSession();
    }, []);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        if (password.length < 6) {
            return setErrorMsg("Password must be at least 6 characters long.");
        }

        if (password !== confirmPassword) {
            return setErrorMsg("Passwords do not match. Please try again.");
        }

        setIsLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw new Error(error.message);

            setIsSuccess(true);

            // Log them out so they are forced to use the new password
            await supabase.auth.signOut();

        } catch (error: any) {
            console.error("Update Error:", error);
            setErrorMsg(error.message || "Failed to update password.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6 transition-colors duration-300">
            <header className="fixed top-0 left-0 w-full h-20 border-b border-border bg-background/90 backdrop-blur-md z-50 flex items-center px-8 lg:px-16 transition-colors">
                <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
                    <Image src="/Receipt_logo.png" alt="StockEasy Logo" width={120} height={40} className="object-contain object-left block dark:hidden scale-125 origin-left" priority />
                    <Image src="/StockEasy_logo.png" alt="StockEasy Logo" width={120} height={40} className="object-contain object-left hidden dark:block" priority />
                </Link>
            </header>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 relative z-10 shadow-xl animate-in zoom-in-95 duration-500 transition-colors">

                {isChecking ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-sm font-medium text-muted-foreground">Authenticating secure link...</p>
                    </div>
                ) : isSuccess ? (
                    <div className="text-center py-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-3">Password Updated!</h2>
                        <p className="text-muted-foreground mb-8 text-sm leading-relaxed font-medium">
                            Your StockEasy account has been secured with your new password.
                        </p>
                        <button
                            onClick={() => router.push('/login')}
                            className="bg-primary text-primary-foreground font-bold py-3 px-6 rounded-xl hover:bg-primary/90 transition-all inline-block w-full shadow-sm cursor-pointer"
                        >
                            Return to Login
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-foreground mb-2">Create New Password</h2>
                            <p className="text-muted-foreground text-sm font-medium">Please enter your new secure password below to regain access to your pharmacy dashboard.</p>
                        </div>

                        {errorMsg && (
                            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex flex-col gap-3 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                                    <p className="text-sm font-bold text-destructive">{errorMsg}</p>
                                </div>
                                <Link href="/forgot-password" className="text-xs font-bold text-destructive underline mt-1">
                                    Click here to request a new link
                                </Link>
                            </div>
                        )}

                        <form onSubmit={handleUpdate} className="space-y-6 animate-in fade-in duration-500">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider">New Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Min 6 characters"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isLoading || !!errorMsg}
                                        className="w-full pl-11 pr-12 py-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/50 disabled:opacity-50 shadow-sm"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                        {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider">Confirm Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="Repeat new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={isLoading || !!errorMsg}
                                        className="w-full pl-11 pr-12 py-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/50 disabled:opacity-50 shadow-sm"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                        {showConfirmPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !password || !confirmPassword || !!errorMsg}
                                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Updating...</> : "Update Password"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}