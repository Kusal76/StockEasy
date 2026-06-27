import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Enabled Admin Client to securely bypass RLS across unauthorized registration views
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // 1. Check Platform Admins (Superadmins)
        const { data: adminMatch } = await supabaseAdmin
            .from('platform_admins')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (adminMatch) {
            return NextResponse.json({ isAvailable: false, reason: "Account already exists as a Platform Administrator." });
        }

        // 2. Check Auth Users / Core Profiles (Owners)
        const { data: userMatch } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (userMatch) {
            return NextResponse.json({ isAvailable: false, reason: "Account already exists." });
        }

        // 3. Check Staff Profiles
        const { data: staffMatch } = await supabaseAdmin
            .from('staff_profiles')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (staffMatch) {
            return NextResponse.json({ isAvailable: false, reason: "Email is registered as a staff member." });
        }

        // If it passes all checks, the email is completely available
        return NextResponse.json({ isAvailable: true });

    } catch (error: any) {
        console.error("Email Check Error:", error);
        return NextResponse.json({ error: "Failed to verify email availability." }, { status: 500 });
    }
}