import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase'; 

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // 1. Check Auth Users (Supabase built-in auth)
        // Note: Supabase auth.users isn't directly queryable from the anon client, 
        // but if you are syncing it to a public.users table, check that!
        const { data: userMatch } = await supabase
            .from('users')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (userMatch) return NextResponse.json({ isAvailable: false, reason: "Account already exists." });

        // 2. Check Staff Profiles
        const { data: staffMatch } = await supabase
            .from('staff_profiles')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (staffMatch) return NextResponse.json({ isAvailable: false, reason: "Email is registered as a staff member." });

        // 3. Check Shop Primary Emails (if your shops table tracks an email)
        const { data: shopMatch } = await supabase
            .from('shops')
            .select('id')
            .eq('contact_email', normalizedEmail) // Adjust column name based on your DB
            .maybeSingle();

        if (shopMatch) return NextResponse.json({ isAvailable: false, reason: "Email is already tied to a registered pharmacy." });

        /* * OPTIONAL: If you REALLY want to block dealers globally, uncomment this.
         * (Not recommended for multi-tenant SaaS as explained above)
         *
         * const { data: dealerMatch } = await supabase
         * .from('dealers')
         * .select('id')
         * .eq('email', normalizedEmail)
         * .maybeSingle();
         * if (dealerMatch) return NextResponse.json({ isAvailable: false, reason: "Email is used by a dealer." });
         */

        // If it passes all checks, it's good to go!
        return NextResponse.json({ isAvailable: true });

    } catch (error: any) {
        console.error("Email Check Error:", error);
        return NextResponse.json({ error: "Failed to verify email availability." }, { status: 500 });
    }
}