import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/lib/supabase-server';
import { tierLimits } from '@/app/lib/rate-limiter'; // IMPORT THE LIMITER

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
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

        // Allows both ADMIN and SUPERADMIN to view the data
        if (!adminProfile || !adminProfile.is_active) {
            return NextResponse.json({ error: "Forbidden: Admin clearance required." }, { status: 403 });
        }
        // -------------------------

        // --- REDIS RATE LIMITER SHIELD ---
        const { success, limit, remaining, reset } = await tierLimits.ADMIN.limit(user.id);

        if (!success) {
            console.warn(`🛑 RATE LIMIT EXCEEDED: Admin ${user.id} hit the brakes.`);
            return new NextResponse(
                JSON.stringify({ error: "Too many requests. Please wait a few seconds before syncing again." }),
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': limit.toString(),
                        'X-RateLimit-Remaining': remaining.toString(),
                        'X-RateLimit-Reset': reset.toString(),
                        'Content-Type': 'application/json'
                    }
                }
            );
        }
        // ------------------------------------

        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate') || "2000-01-01T00:00:00.000Z";

        const [
            { count: totalCount },
            { count: activeCount },
            { count: pendingCount },
            { data: shops },
            { data: bills }
        ] = await Promise.all([
            supabaseAdmin.from('shops').select('*', { count: 'exact', head: true }).gte('created_at', startDate),
            supabaseAdmin.from('shops').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').gte('created_at', startDate),
            supabaseAdmin.from('shops').select('*', { count: 'exact', head: true }).eq('status', 'PENDING').gte('created_at', startDate),
            supabaseAdmin.from('shops').select('id, name, created_at, address').gte('created_at', startDate),
            supabaseAdmin.from('bills').select('total_amount, created_at, shop_id').gte('created_at', startDate)
        ]);

        return NextResponse.json({
            totalCount: totalCount || 0,
            activeCount: activeCount || 0,
            pendingCount: pendingCount || 0,
            shops: shops || [],
            bills: bills || []
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}