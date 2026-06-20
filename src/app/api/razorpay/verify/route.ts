import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { razorpay_order_id, razorpay_payment_id, shop_id, new_plan } = await req.json();

        // 1. Database Upgrade Operation
        const { error } = await supabaseAdmin
            .from('shops')
            .update({ plan: new_plan.toUpperCase() })
            .eq('id', shop_id);

        if (error) {
            console.error("Database Update Error:", error);
            return NextResponse.json({ error: "Failed to update plan in database" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Subscription upgraded successfully!" });

    } catch (error: any) {
        console.error("Verification Error:", error);
        return NextResponse.json({ error: "Internal server error during verification" }, { status: 500 });
    }
}