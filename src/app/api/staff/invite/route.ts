import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase with the ADMIN key to allow user creation
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { email, name, role, shopId, inviterId } = await req.json();

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: "Server misconfiguration. Missing Admin Key." }, { status: 500 });
        }

        // 1. Security Check: Ensure the person making the request is actually an OWNER
        const { data: inviterData, error: inviterError } = await supabaseAdmin
            .from('users')
            .select('role, shop_id')
            .eq('id', inviterId)
            .single();

        if (inviterError || inviterData.role !== 'OWNER' || inviterData.shop_id !== shopId) {
            return NextResponse.json({ error: "Unauthorized. Only shop owners can invite staff." }, { status: 403 });
        }

        // 2. --- THE 100% RELIABLE LOCAL DEMO BYPASS ---
        const { data: linkData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email: email,
            options: {
                data: { full_name: name, role: role, shop_id: shopId },
                redirectTo: 'http://localhost:3000/set-password'
            }
        });

        if (inviteError) {
            if (inviteError.message.includes("already registered")) {
                return NextResponse.json({ error: "This email is already registered." }, { status: 400 });
            }
            throw inviteError;
        }

        // 🚨 PRINT THE UNTOUCHED LINK DIRECTLY TO YOUR VS CODE TERMINAL
        console.log("\n\n🔥 PRISTINE INVITE LINK (COPY THIS DURING DEMO):");
        console.log(linkData.properties?.action_link);
        console.log("------------------------------------------------\n\n");

        const newUserId = linkData.user.id;

        // 3. Bind the new user to the Shop in the public tables
        await supabaseAdmin.from('users').insert({
            id: newUserId,
            shop_id: shopId,
            role: role,
            full_name: name,
            email: email
        });

        await supabaseAdmin.from('staff_profiles').insert({
            id: newUserId,
            shop_id: shopId,
            name: name,
            email: email,
            role: role,
            status: 'PENDING'
        });

        return NextResponse.json({ success: true, message: "Invitation generated. Check your terminal." });

    } catch (error: any) {
        console.error("Invite API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate invitation." }, { status: 500 });
    }
}