import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

export async function POST(req: Request) {
    try {
        // --- 🚨 SECURITY CHECK ---
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: profile } = await supabaseAdmin
            .from("platform_admins")
            .select("role, is_active")
            .eq("id", user.id)
            .single();

        if (!profile || profile.role !== "SUPERADMIN" || !profile.is_active) {
            return NextResponse.json({ error: "Forbidden: Superadmin clearance required." }, { status: 403 });
        }
        // -------------------------

        // Clear Next.js caches globally
        revalidatePath('/', 'layout');

        return NextResponse.json({
            success: true,
            message: "System cache purged and revalidated successfully."
        });
    } catch (error: any) {
        console.error("❌ CACHE PURGE FAILED:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}