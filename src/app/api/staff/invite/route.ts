import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/lib/supabase-server';
import { Client } from '@upstash/qstash';

// Initialize QStash
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

        // Ensure the person inviting is actually a shop Owner/Manager
        const { data: inviterProfile } = await supabase
            .from('users')
            .select('role, shop_id')
            .eq('id', user.id)
            .single();

        if (!inviterProfile || !inviterProfile.shop_id || inviterProfile.role !== 'OWNER') {
            return NextResponse.json({ error: "Forbidden: Only pharmacy owners can invite staff." }, { status: 403 });
        }
        // -------------------------

        const { email: staffEmail, name: staffName } = await req.json();

        if (!staffEmail || !staffName) {
            return NextResponse.json({ error: "Email and Name are required." }, { status: 400 });
        }

        const shopId = inviterProfile.shop_id;

        // Fetch the shop name for the email
        const { data: shopData } = await supabaseAdmin.from('shops').select('name').eq('id', shopId).single();
        const shopName = shopData?.name || "the Pharmacy";

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'https://stock-easy-orpin.vercel.app';

        // 1. Ask Supabase to securely generate the invite link
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email: staffEmail,
            options: {
                redirectTo: `${baseUrl}/set-password`,
                data: {
                    role: 'STAFF',
                    shop_id: shopId,
                    full_name: staffName
                }
            }
        });

        if (linkError || !linkData?.properties?.action_link || !linkData.user) {
            throw new Error(linkError?.message || "Failed to generate secure invite link.");
        }

        const secureInviteLink = linkData.properties.action_link;

        // 🚨 DB FIX 1: Insert into 'users' table (No 'status' column, uses 'full_name')
        const { error: userError } = await supabaseAdmin.from('users').upsert({
            id: linkData.user.id,
            email: staffEmail,
            full_name: staffName,
            role: 'STAFF',
            shop_id: shopId
        });

        if (userError) {
            console.error("Failed to create users profile:", userError);
            throw new Error("Could not create the user profile in the database.");
        }

        // 🚨 DB FIX 2: Insert into 'staff_profiles' table (Has 'status' column, uses 'name')
        const { error: staffError } = await supabaseAdmin.from('staff_profiles').upsert({
            id: linkData.user.id, // Keep the IDs identical for easy linking!
            email: staffEmail,
            name: staffName,      // Notice this is 'name', not 'full_name'
            role: 'STAFF',
            shop_id: shopId,
            status: 'PENDING'     // Set to pending until they set their password
        });

        if (staffError) {
            console.error("Failed to create staff profile:", staffError);
            // We won't throw an error here so the email still sends even if this minor table fails
        }

        // 2. Offload Email Dispatch to QStash
        await qstash.publishJSON({
            url: `${baseUrl}/api/webhooks/onboarding/staff-invite`,
            body: {
                staffEmail,
                staffName,
                shopName,
                inviteLink: secureInviteLink
            }
        });

        console.log(`📨 Staff invite job queued for ${staffEmail}`);

        return NextResponse.json({ success: true, message: "Invitation sent successfully!" });

    } catch (error: any) {
        console.error("Staff Invite Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}