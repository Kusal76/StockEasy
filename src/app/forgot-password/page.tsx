// TODO: BEFORE DEPLOYMENT (Vercel/Netlify)
// 1. Go to Supabase Dashboard -> Authentication -> URL Configuration
// 2. Add the production URL (e.g., https://stockeasy.vercel.app/**) to the Redirect URLs
// 3. Add Supabase ENV variables to Vercel project settings


"use client";

import { useState } from "react";
import { createBrowserClient } from '@supabase/ssr';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [isSuccess, setIsSuccess] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");
        setIsLoading(true);

        try {
            // 1. Initialize the SSR-friendly client so the PKCE verifier goes into a cookie
            const supabaseSSR = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            // 2. Use THIS specific client to send the email
            const { error } = await supabaseSSR.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
            });

            if (error) throw new Error(error.message);

            setIsSuccess(true);
        } catch (error: any) {
            console.error("Reset Error:", error);
            setErrorMsg(error.message || "Failed to send reset email.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6 transition-colors duration-300">

            {/* Header / Logo */}
            <header className="fixed top-0 left-0 w-full h-20 border-b border-border bg-background/90 backdrop-blur-md z-50 flex items-center px-8 lg:px-16 transition-colors">
                <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
                    <Image src="/Receipt_logo.png" alt="StockEasy Logo" width={120} height={40} className="object-contain object-left block dark:hidden scale-125 origin-left" priority />
                    <Image src="/StockEasy_logo.png" alt="StockEasy Logo" width={120} height={40} className="object-contain object-left hidden dark:block" priority />
                </Link>
            </header>

            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 relative z-10 shadow-xl animate-in zoom-in-95 duration-500 transition-colors">

                {isSuccess ? (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <CheckCircle2 className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-3">Check your email</h2>
                        <p className="text-muted-foreground mb-8 text-sm leading-relaxed font-medium">
                            We've sent a secure password reset link to <br />
                            <span className="text-foreground font-bold">{email}</span>
                        </p>
                        <Link href="/login" className="bg-background border border-border text-foreground font-bold py-3 px-6 rounded-xl hover:bg-muted transition-all inline-block w-full shadow-sm">
                            Return to Login
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="mb-8">
                            <Link href="/login" className="inline-flex items-center text-xs font-mono font-bold text-muted-foreground hover:text-primary transition-colors mb-6">
                                <ArrowLeft className="w-4 h-4 mr-2" /> BACK TO LOGIN
                            </Link>
                            <h2 className="text-2xl font-bold text-foreground mb-2">Reset Password</h2>
                            <p className="text-muted-foreground text-sm font-medium">Enter your registered email address and we'll send you a link to reset your password.</p>
                        </div>

                        {errorMsg && (
                            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-3 shadow-sm">
                                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                                <p className="text-sm font-bold text-destructive">{errorMsg}</p>
                            </div>
                        )}

                        <form onSubmit={handleReset} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="email"
                                        placeholder="shop@pharmacy.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isLoading}
                                        className="w-full pl-11 pr-4 py-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/50 disabled:opacity-50 shadow-sm"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !email}
                                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:bg-primary/90 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Sending Link...</> : "Send Reset Link"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}