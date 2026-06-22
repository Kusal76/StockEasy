"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setupPermanentPassword } from "@/actions/admin";
import { ShieldCheck, Loader2, AlertTriangle, KeyRound, Eye, EyeOff } from "lucide-react";

export default function SetupPasswordPage() {
    const router = useRouter();
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsProcessing(true);
        setError("");

        try {
            const formData = new FormData(e.currentTarget);
            const result = await setupPermanentPassword(formData);

            if (result.success) {
                router.push("/admin");
            }
        } catch (err: any) {
            setError(err.message);
            setIsProcessing(false);
        }
    };

    return (
        // THE FIX: Changed to min-h-screen to snap perfectly without scrolling
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-lg p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-primary/10 rounded-full">
                        <KeyRound className="w-8 h-8 text-primary" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-center mb-2">Secure Your Account</h1>
                <p className="text-sm text-muted-foreground text-center mb-8">
                    For security purposes, you must change your temporary password before accessing the administrative control panel.
                </p>

                {error && (
                    <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">New Password</label>
                        <div className="relative group">
                            <input
                                required
                                name="password"
                                type={showPassword ? "text" : "password"}
                                minLength={8}
                                className="w-full bg-background border border-border rounded-lg pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1"
                            >
                                {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Confirm New Password</label>
                        <div className="relative group">
                            <input
                                required
                                name="confirmPassword"
                                type={showConfirmPassword ? "text" : "password"}
                                minLength={8}
                                className="w-full bg-background border border-border rounded-lg pl-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1"
                            >
                                {showConfirmPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button
                        disabled={isProcessing}
                        type="submit"
                        className="w-full mt-6 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                        {isProcessing ? "Securing Account..." : "Set Permanent Password"}
                    </button>
                </form>
            </div>
        </div>
    );
}