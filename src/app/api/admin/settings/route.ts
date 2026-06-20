import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
    try {
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
        const payload = await req.json();

        const { error } = await supabaseAdmin
            .from('platform_settings')
            .update({
                ...payload,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1);

        if (error) {
            // This will print the EXACT database rejection reason in your VS Code terminal!
            console.error("❌ SUPABASE UPDATE REJECTED:", error);
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}