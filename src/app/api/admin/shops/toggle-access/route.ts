import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/lib/supabase-server';
import { redis } from '@/app/lib/redis'; // 1. IMPORT REDIS

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

        const { shopId, action } = await req.json();

        if (!shopId || !action) {
            return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
        }

        const targetStatus = action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';
        const expectedCurrentStatus = action === 'SUSPEND' ? 'ACTIVE' : 'SUSPENDED';

        // COLLISION PREVENTION
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

        // --- 2. INSTANT REDIS AUTH REVOCATION ---
        if (action === 'SUSPEND') {
            // Add to blacklist and auto-expire the ban cache after 24 hours 
            // (By then, their JWT is dead anyway, saving Redis RAM)
            await redis.setex(`blacklist:shop:${shopId}`, 86400, 'SUSPENDED');
            console.log(`🛑 Shop ${shopId} added to Redis Blacklist.`);
        } else {
            // Remove from blacklist if restored
            await redis.del(`blacklist:shop:${shopId}`);
            console.log(`✅ Shop ${shopId} removed from Redis Blacklist.`);
        }
        // ----------------------------------------

        return NextResponse.json({ success: true, newStatus: targetStatus });
    } catch (error: any) {
        console.error("Toggle Access API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}