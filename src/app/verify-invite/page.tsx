"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { MailCheck, Loader2, AlertTriangle } from "lucide-react";

function VerifyContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState("");

    const handleVerify = async () => {
        if (!token) {
            setError("Invalid or missing invitation token.");
            return;
        }

        setIsVerifying(true);
        setError("");

        try {
            // This securely exchanges the hash for a real logged-in session
            const { error: verifyError } = await supabase.auth.verifyOtp({
                token_hash: token,
                type: 'invite'
            });

            if (verifyError) throw verifyError;

            // Success! The user is now authenticated. Send them to set their password.
            router.push('/set-password');

        } catch (err: any) {
            setError(err.message || "Failed to verify invitation. It may have expired.");
            setIsVerifying(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-[#051424] flex items-center justify-center p-4">
                <div className="bg-[#0d1c2d] p-8 rounded-2xl border border-destructive/50 text-center">
                    <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                    <h2 className="text-white text-xl font-bold">Invalid Link</h2>
                    <p className="text-[#bdcabc] mt-2">No verification token found in the URL.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#051424] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#0d1c2d] border border-[#3e4a3f]/50 rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in-95">
                <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <MailCheck className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Verify Your Invite</h1>
                <p className="text-[#bdcabc] text-sm mb-8">
                    You have been invited to join the StockEasy platform. Click below to securely accept your invitation.
                </p>

                {error && (
                    <div className="bg-destructive/10 border border-destructive/50 text-destructive text-sm p-3 rounded-lg mb-6 text-left">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleVerify}
                    disabled={isVerifying}
                    className="w-full bg-primary hover:bg-primary/90 text-[#051424] font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : "Securely Accept Invite"}
                </button>
            </div>
        </div>
    );
}

export default function VerifyInvitePage() {
    // Next.js requires useSearchParams to be wrapped in Suspense
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#051424]" />}>
            <VerifyContent />
        </Suspense>
    );
}