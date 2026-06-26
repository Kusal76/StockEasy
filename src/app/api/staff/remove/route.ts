import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// MUST use the Service Role Key to bypass RLS and access the hidden auth.users table
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { staffAuthId, staffProfileId } = await req.json();

        if (!staffAuthId) {
            return NextResponse.json({ error: "Staff Auth ID is required" }, { status: 400 });
        }

        // 1. HARD DELETE: Remove the user entirely from the Supabase Auth system.
        const { error: authError } =
            await supabaseAdmin.auth.admin.deleteUser(staffAuthId);

        if (authError) {
            console.error("Failed to delete Auth user:", authError);
            throw authError;
        }

        // 2. CLEANUP: Delete from your public staff_profiles table
        if (staffProfileId) {
            await supabaseAdmin
                .from('staff_profiles')
                .delete()
                .eq('id', staffProfileId);
        }

        return NextResponse.json({ success: true, message: "Staff completely removed." });

    } catch (error: any) {
        console.error("Remove Staff API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}