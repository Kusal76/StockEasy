import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/lib/supabase-server';
import { Client } from '@upstash/qstash';

// FIX: Force the QStash client to use the US-East region
const qstash = new Client({
    token: process.env.QSTASH_TOKEN!,
    baseUrl: "https://qstash-us-east-1.upstash.io"
});

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        // --- SECURITY PERIMETER ---
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: adminProfile } = await supabaseAdmin
            .from('platform_admins')
            .select('role, is_active')
            .eq('id', user.id)
            .maybeSingle();

        if (!adminProfile || !adminProfile.is_active) {
            return NextResponse.json({ error: "Forbidden: Admin clearance required." }, { status: 403 });
        }
        // -------------------------

        const { shopId, status, rejectionReason } = await req.json();

        // 1. Update the shop status ONLY if it hasn't been processed yet
        // 🚨 ADDED 'id' to the select query so we know which Auth user to delete!
        const { data: shopData, error: updateError } = await supabaseAdmin
            .from('shops')
            .update(
                status === 'ACTIVE'
                    ? {
                        status: 'ACTIVE',
                        scheduled_deletion_date: null,
                        admin_notes: null
                    }
                    : {
                        status: status
                    }
            )
            .eq('id', shopId)
            .in('status', ['PENDING', 'PENDING_DELETION'])
            .select('name, users(id, email, full_name)')
            .maybeSingle();

        if (updateError) throw new Error("Database error during status update.");

        if (!shopData) {
            return NextResponse.json({
                error: "Collision Detected: Another administrator has already processed this application."
            }, { status: 409 });
        }

        const ownerEmail = shopData.users?.[0]?.email;
        const ownerName = shopData.users?.[0]?.full_name || "Pharmacy Owner";
        const shopName = shopData.name;

        // --- 2. THE BACKGROUND JOB QUEUE ---
        if (ownerEmail) {
            // Get the base URL (so QStash knows where to send the webhook)
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';

            // Push the job to the queue
            await qstash.publishJSON({
                url: `${baseUrl}/api/webhooks/send-email`,
                body: {
                    ownerEmail,
                    ownerName,
                    shopName,
                    status,
                    rejectionReason,
                    baseUrl
                },
                // FIX: Add the tunnel bypass header for local testing stability
                headers: {
                    "Upstash-Forward-Bypass-Tunnel-Reminder": "true"
                }
            });
            console.log("📨 Email job pushed to QStash queue!");
        }

        // --- 3. 🚨 THE "WIPE THE SLATE CLEAN" LOGIC ---
        if (status === "REJECTED") {
            try {
                // A. Delete the users from Supabase Authentication (Frees the email)
                if (shopData.users && shopData.users.length > 0) {
                    for (const shopUser of shopData.users) {
                        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(shopUser.id);
                        if (authDeleteError) {
                            console.error(`Failed to delete auth user ${shopUser.id}:`, authDeleteError.message);
                        } else {
                            console.log(`Successfully freed email for rejected user ${shopUser.id}`);
                        }
                    }
                }

                // B. Completely delete the shop row so the database is clean
                const { error: shopDeleteError } = await supabaseAdmin
                    .from('shops')
                    .delete()
                    .eq('id', shopId);

                if (shopDeleteError) {
                    console.error(`Failed to delete rejected shop ${shopId}:`, shopDeleteError.message);
                } else {
                    console.log(`Successfully erased rejected shop ${shopId}`);
                }

            } catch (cleanupError) {
                console.error("Error during rejected user cleanup:", cleanupError);
                // We don't crash here because the email is already on its way.
            }
        }

        // 4. Return INSTANTLY so the Admin UI doesn't hang
        return NextResponse.json({ success: true, emailQueued: !!ownerEmail });
    } catch (error: any) {
        console.error("Shop Review API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}