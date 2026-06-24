import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/lib/supabase-server';
import { Client } from '@upstash/qstash'; // 1. IMPORT QSTASH

// Initialize QStash Client
const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

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
            .select('role, is_active, full_name')
            .eq('id', user.id)
            .maybeSingle();

        if (!adminProfile || !adminProfile.is_active) {
            return NextResponse.json({ error: "Forbidden: Admin clearance required." }, { status: 403 });
        }
        // -------------------------

        const { dbId, displayId, email, name, originalMessage, adminReply } = await req.json();

        if (!dbId || !email || !adminReply) {
            return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
        }

        // GENERATE THE SIGNATURE
        const shortUUID = user.id.substring(0, 8);
        const adminName = adminProfile.full_name || "Platform Admin";
        const adminSignature = `${adminName} (${shortUUID})`;

        // 1. Update the database: ONLY if it is currently OPEN
        const { data: updatedTicket, error: dbError } = await supabaseAdmin
            .from('support_tickets')
            .update({
                status: 'RESOLVED',
                admin_reply: adminReply,
                resolved_by: adminSignature
            })
            .eq('id', dbId)
            .eq('status', 'OPEN') // THE SHIELD
            .select('id')
            .maybeSingle();

        if (dbError) throw new Error("Database error during ticket update.");

        if (!updatedTicket) {
            return NextResponse.json({
                error: "Collision Detected: Another administrator has already resolved this ticket."
            }, { status: 409 });
        }

        // --- 2. THE BACKGROUND JOB QUEUE ---
        // Get the base URL so QStash knows where to send the webhook
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';

        // Push the job to the queue
        await qstash.publishJSON({
            url: `${baseUrl}/api/webhooks/support-reply`,
            body: {
                email,
                name,
                displayId,
                originalMessage,
                adminReply,
                adminName
            }
        });

        console.log(`📨 Support reply job for ticket ${displayId} pushed to QStash queue!`);
        // ------------------------------------

        // 3. Return INSTANTLY
        return NextResponse.json({ success: true, emailQueued: true });
    } catch (error: any) {
        console.error("Reply API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}