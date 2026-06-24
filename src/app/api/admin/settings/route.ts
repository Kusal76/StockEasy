import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/lib/supabase-server';
import { redis } from '@/app/lib/redis'; // ADDED: Import Redis

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

        // ADDED: REDIS CACHE CHECK (The "Cache Hit")
        const cachedSettings = await redis.get('platform:settings');

        if (cachedSettings) {
            console.log("⚡ REDIS CACHE HIT: Loaded settings from memory.");
            return NextResponse.json({ settings: cachedSettings });
        }

        // FALLBACK TO DATABASE (The "Cache Miss")
        console.log("💽 CACHE MISS: Querying Supabase for settings.");
        const { data, error } = await supabaseAdmin
            .from('platform_settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) throw error;

        // ADDED: STORE IN REDIS FOR NEXT TIME
        await redis.set('platform:settings', data);

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

        // UPDATED: Added .select().single() to get the updated row back from Supabase
        const { data: updatedData, error } = await supabaseAdmin
            .from('platform_settings')
            .update({
                ...payload,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1)
            .select()
            .single();

        if (error) {
            console.error("❌ SUPABASE UPDATE REJECTED:", error);
            throw error;
        }

        // ADDED: INSTANTLY OVERWRITE THE REDIS CACHE
        if (updatedData) {
            await redis.set('platform:settings', updatedData);
            console.log("⚡ REDIS CACHE UPDATED: Fresh settings stored in memory.");
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}