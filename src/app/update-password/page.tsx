"use client";

import { useState, useEffect } from "react";
import { Lock, EyeOff, Eye, CheckCircle2, AlertCircle, Loader2, ShieldAlert } from "lucide-react";
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

    // 🚨 NEW: MFA States for Recovery Update
    const [mfaChallengeData, setMfaChallengeData] = useState<{ factorId: string, challengeId: string } | null>(null);
    const [mfaCode, setMfaCode] = useState("");

    useEffect(() => {
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

        if (password.length < 8) {
            return setErrorMsg("Password must be at least 8 characters long.");
        }

        if (password !== confirmPassword) {
            return setErrorMsg("Passwords do not match. Please try again.");
        }

        setIsLoading(true);

        try {
            // 1. Check if user has an Authenticator app linked (MFA Verification)
            const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (aalError) throw aalError;

            // 2. If MFA is enabled but user is only AAL1, trigger the challenge
            if (aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
                const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
                if (factorsError) throw factorsError;

                const totpFactor = factors.totp[0];
                if (!totpFactor) throw new Error("MFA is enrolled but no TOTP factor was found.");

                const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
                if (challengeError) throw challengeError;

                setMfaChallengeData({ factorId: totpFactor.id, challengeId: challenge.id });
                setIsLoading(false);
                return; // Stop here and show the 6-digit code box
            }

            // 3. If no MFA is active, update directly
            await commitPasswordUpdate();

        } catch (error: any) {
            console.error("Update Error:", error);
            setErrorMsg(error.message || "Failed to update password.");
            setIsLoading(false);
        }
    };

    // 🚨 NEW: Verify 2FA code and commit change
    const handleVerifyMfaAndUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mfaChallengeData || mfaCode.length !== 6) {
            setErrorMsg("Please enter a valid 6-digit code.");
            return;
        }

        setIsLoading(true);
        setErrorMsg("");
        try {
            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId: mfaChallengeData.factorId,
                challengeId: mfaChallengeData.challengeId,
                code: mfaCode
            });

            if (verifyError) throw new Error("Invalid authenticator code.");

            // Session is elevated to AAL2. Run the update!
            await commitPasswordUpdate();
        } catch (error: any) {
            setErrorMsg(error.message || "MFA verification failed.");
            setIsLoading(false);
        }
    };

    const commitPasswordUpdate = async () => {
        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) throw new Error(error.message);

        setIsSuccess(true);
        // Force log out so they re-authenticate into a clean dashboard
        await supabase.auth.signOut();
        setIsLoading(false);
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
                        <button onClick={() => router.push('/login')} className="bg-primary text-primary-foreground font-bold py-3 px-6 rounded-xl hover:bg-primary/90 transition-all inline-block w-full shadow-sm cursor-pointer">
                            Return to Login
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-foreground mb-2">Create New Password</h2>
                            <p className="text-muted-foreground text-sm font-medium">Please enter your new secure password below to regain access to your dashboard.</p>
                        </div>

                        {errorMsg && (
                            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex flex-col gap-3 shadow-sm animate-in fade-in">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                                    <p className="text-sm font-bold text-destructive">{errorMsg}</p>
                                </div>
                                <Link href="/forgot-password" className="text-xs font-bold text-destructive underline mt-1">
                                    Click here to request a new link
                                </Link>
                            </div>
                        )}

                        {/* 🚨 NEW UI: Conditional 2FA Verification View */}
                        {mfaChallengeData ? (
                            <form onSubmit={handleVerifyMfaAndUpdate} className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                                <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl mb-4">
                                    <p className="text-sm font-bold text-primary mb-1">MFA Security Verification</p>
                                    <p className="text-xs text-muted-foreground">Your account has 2FA active. Open your authenticator app and enter the code to finish changing your password.</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">6-Digit Code</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        required
                                        value={mfaCode}
                                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground text-lg tracking-[0.5em] font-mono text-center shadow-sm focus:border-primary outline-none"
                                        placeholder="•••••"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setMfaChallengeData(null)} className="w-full px-4 py-3 rounded-xl font-bold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors cursor-pointer text-sm">Back</button>
                                    <button type="submit" disabled={isLoading || mfaCode.length !== 6} className="w-full px-4 py-3 rounded-xl font-bold text-primary-foreground bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer text-sm">
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Save"}
                                    </button>
                                </div>
                            </form>
                        ) : (
                                <form onSubmit={handleUpdate} className="space-y-6 animate-in fade-in duration-500">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-wider">New Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Min 8 characters"
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
                        )}
                    </>
                )}
            </div>
        </div>
    );
}