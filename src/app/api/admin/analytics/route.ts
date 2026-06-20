import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate') || "2000-01-01T00:00:00.000Z";

        // Fetch all platform data using the master key
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