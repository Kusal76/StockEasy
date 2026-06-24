import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from '@upstash/qstash';

// Initialize QStash
const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, message } = body;

        if (!name || !email || !message) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Save to Supabase
        const { data: ticket, error: dbError } = await supabaseAdmin
            .from('support_tickets')
            .insert([{ name, email, message, status: 'OPEN' }])
            .select('id')
            .single();

        if (dbError || !ticket) throw new Error("Failed to log support ticket in the database.");

        const friendlyTicketId = `TKT-${String(ticket.id).split('-')[0].toUpperCase()}`;

        // 2. Offload Email Dispatch to QStash
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';

        await qstash.publishJSON({
            url: `${baseUrl}/api/webhooks/support-new`,
            body: {
                name,
                email,
                message,
                friendlyTicketId
            }
        });

        // 3. Return instantly to the user
        return NextResponse.json({ success: true, ticketId: friendlyTicketId });

    } catch (error: any) {
        console.error("Support Ticket Error:", error);
        return NextResponse.json({ error: "Failed to submit ticket" }, { status: 500 });
    }
}