"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../app/lib/supabase"; // <-- Adjust import path if needed

export default function RealtimeAuthGuard({ currentUserId }: { currentUserId: string }) {
    const router = useRouter();

    useEffect(() => {
        if (!currentUserId) return;

        const securityChannel = supabase
            .channel(`staff-security-${currentUserId}`)
            .on(
                "postgres_changes",
                {
                    event: "*", // Listen for ALL events (DELETE and UPDATE)
                    schema: "public",
                    table: "staff_profiles",
                    filter: `id=eq.${currentUserId}`
                },
                async (payload: any) => {
                    // Scenario A: The owner clicked the Trash Can (Hard Delete)
                    const isDeleted = payload.eventType === "DELETE";

                    // Scenario B: The owner changed the status dropdown to SUSPENDED
                    const isSuspended = payload.eventType === "UPDATE" && payload.new.status === "SUSPENDED";

                    // If neither of these security events happened, ignore and exit
                    if (!isDeleted && !isSuspended) return;

                    console.warn(`Security Event: User was ${isDeleted ? 'deleted' : 'suspended'}.`, payload);

                    // 1. Instantly kill the session
                    await supabase.auth.signOut();

                    // 2. Redirect to login
                    router.push("/login");

                    // 3. Fire the specific alert based on what the owner did
                    const alertMessage = isDeleted
                        ? "Your access permissions have been completely revoked by the pharmacy owner."
                        : "Your account has been SUSPENDED by the pharmacy owner.";

                    setTimeout(() => {
                        alert(`SECURITY ALERT:\n${alertMessage}\n\nYou have been securely logged out.`);
                    }, 100);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(securityChannel);
        };
    }, [currentUserId, router]);

    return null;
}