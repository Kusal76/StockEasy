import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/lib/supabase-server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

        if (!adminProfile || !adminProfile.is_active) {
            return NextResponse.json({ error: "Forbidden: Admin clearance required." }, { status: 403 });
        }
        // -------------------------

        const { shopId, action } = await req.json(); // action is 'SUSPEND' or 'RESTORE'

        if (!shopId || !action) {
            return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
        }

        const targetStatus = action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';
        const expectedCurrentStatus = action === 'SUSPEND' ? 'ACTIVE' : 'SUSPENDED';

        // COLLISION PREVENTION: Only update if the status is exactly what we expect it to be
        const { data: updatedShop, error } = await supabaseAdmin
            .from('shops')
            .update({ status: targetStatus })
            .eq('id', shopId)
            .eq('status', expectedCurrentStatus)
            .select('id')
            .maybeSingle();

        if (error) throw new Error("Database error while updating shop access.");

        if (!updatedShop) {
            return NextResponse.json({
                error: "Collision Detected: Another admin may have already changed this shop's status."
            }, { status: 409 });
        }

        // Optional: If you want to automatically kick the owner out of their active session
        // when suspended, you could add logic here to invalidate their auth token via Supabase Admin.

        return NextResponse.json({ success: true, newStatus: targetStatus });
    } catch (error: any) {
        console.error("Toggle Access API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}