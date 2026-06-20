import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use the Service Role Key to safely bypass RLS for Admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const { id } = resolvedParams;

        // 1. Fetch Shop & Owner Data
        const { data: shop, error: shopError } = await supabaseAdmin
            .from("shops")
            .select("*, users(*)")
            .eq("id", id)
            .single();

        if (shopError) throw shopError;

        // 2. Fetch Deep Tenant Metrics simultaneously
        const [inventoryReq, staffReq, billsReq] = await Promise.all([
            supabaseAdmin.from('inventory').select('*', { count: 'exact' }).eq('shop_id', id).order('created_at', { ascending: false }).limit(100),
            supabaseAdmin.from('staff_profiles').select('*', { count: 'exact' }).eq('shop_id', id).order('created_at', { ascending: false }),
            supabaseAdmin.from('bills').select('*', { count: 'exact' }).eq('shop_id', id).order('created_at', { ascending: false }).limit(100)
        ]);

        return NextResponse.json({
            shop,
            inventory: inventoryReq.data || [],
            inventoryCount: inventoryReq.count || 0,
            staff: staffReq.data || [],
            staffCount: staffReq.count || 0,
            bills: billsReq.data || [],
            billsCount: billsReq.count || 0
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const { id } = resolvedParams;
        const body = await req.json();
        const { newPlan } = body;

        // Force override the subscription plan
        const { error } = await supabaseAdmin
            .from('shops')
            .update({ plan: newPlan })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}