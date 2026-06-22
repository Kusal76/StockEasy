import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/lib/supabase-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
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

        if (!adminProfile || !adminProfile.is_active || adminProfile.role !== "SUPERADMIN") {
            return NextResponse.json({ error: "Forbidden: SuperAdmin clearance required." }, { status: 403 });
        }
        // -------------------------

        const { data, error } = await supabaseAdmin
            .from('platform_settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) throw error;
        return NextResponse.json({ settings: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

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

        if (!adminProfile || !adminProfile.is_active || adminProfile.role !== "SUPERADMIN") {
            return NextResponse.json({ error: "Forbidden: SuperAdmin clearance required." }, { status: 403 });
        }
        // -------------------------

        const payload = await req.json();

        const { error } = await supabaseAdmin
            .from('platform_settings')
            .update({
                ...payload,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1);

        if (error) {
            console.error("❌ SUPABASE UPDATE REJECTED:", error);
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}