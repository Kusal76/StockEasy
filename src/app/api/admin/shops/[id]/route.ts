import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/app/lib/supabase-server';

// Use the Service Role Key to safely bypass RLS for Admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

        const resolvedParams = await params;
        const { id } = resolvedParams;
        const body = await req.json();

        // Extract both newPlan and status from the incoming request
        const { newPlan, status } = body;

        // 🚨 NEW: SECURE ACCOUNT ERADICATION FOR REJECTED SHOPS
        if (status === "REJECTED") {
            try {
                // 1. Find all users tied to this rejected shop
                const { data: shopUsers, error: fetchError } = await supabaseAdmin
                    .from('users')
                    .select('id')
                    .eq('shop_id', id);

                if (fetchError) throw fetchError;

                // 2. Permanently delete them from Supabase Authentication
                // This is what officially frees up their email address for re-registration
                if (shopUsers && shopUsers.length > 0) {
                    for (const shopUser of shopUsers) {
                        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(shopUser.id);
                        if (deleteError) {
                            console.error(`Failed to delete auth user ${shopUser.id}:`, deleteError);
                            // If this fails due to a foreign key constraint, you MUST run the ON DELETE CASCADE SQL fix in your Supabase dashboard
                            return NextResponse.json({ error: "Database constraint blocking deletion. Ensure CASCADE is enabled on users table." }, { status: 500 });
                        } else {
                            console.log(`Successfully wiped rejected user ${shopUser.id} from Auth.`);
                        }
                    }
                }

                // 3. Completely delete the rejected shop from the database
                const { error: shopDeleteError } = await supabaseAdmin
                    .from('shops')
                    .delete()
                    .eq('id', id);

                if (shopDeleteError) throw shopDeleteError;

                return NextResponse.json({
                    success: true,
                    message: "Shop rejected. Owner account and shop data wiped so they can register again."
                });

            } catch (cleanupError: any) {
                console.error("Error during rejected user cleanup:", cleanupError);
                return NextResponse.json({ error: cleanupError.message }, { status: 500 });
            }
        }

        // If it is NOT a rejection, proceed with the normal update logic
        const updatePayload: any = {};
        if (newPlan) updatePayload.plan = newPlan;
        if (status) updatePayload.status = status;

        // Update the shop record
        const { error } = await supabaseAdmin
            .from('shops')
            .update(updatePayload)
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}