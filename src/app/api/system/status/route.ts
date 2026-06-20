import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use Admin key to bypass RLS, but ONLY return the two safe boolean flags
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('platform_settings')
            .select('maintenance_mode, onboarding_enabled')
            .eq('id', 1)
            .single();

        if (error) throw error;

        return NextResponse.json({
            maintenanceMode: data.maintenance_mode,
            onboardingEnabled: data.onboarding_enabled
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}