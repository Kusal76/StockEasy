import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
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

        const { shopId, status, rejectionReason } = await req.json(); // status will be 'ACTIVE' or 'REJECTED'

        // 1. Update the shop status ONLY if it hasn't been processed yet
        const { data: shopData, error: updateError } = await supabaseAdmin
            .from('shops')
            .update({ status: status })
            .eq('id', shopId)
            .in('status', ['PENDING', 'PENDING_DELETION']) // THE SHIELD: Only update if it's currently pending!
            .select('name, users(email, full_name)')
            .maybeSingle(); // Use maybeSingle so it doesn't crash if 0 rows are updated

        if (updateError) throw new Error("Database error during status update.");

        // If shopData is null, it means the row wasn't updated because the status wasn't PENDING anymore!
        if (!shopData) {
            return NextResponse.json({
                error: "Collision Detected: Another administrator has already processed this application."
            }, { status: 409 }); // 409 Conflict Status Code
        }

        if (updateError || !shopData) throw new Error("Failed to update shop status in database.");

        const ownerEmail = shopData.users?.[0]?.email;
        const ownerName = shopData.users?.[0]?.full_name || "Pharmacy Owner";
        const shopName = shopData.name;

        // 2. Fetch live SMTP Settings
        const { data: settings } = await supabaseAdmin
            .from('platform_settings')
            .select('smtp_host, smtp_user, smtp_pass, platform_name')
            .eq('id', 1)
            .single();

        if (!settings || !settings.smtp_host || !settings.smtp_pass) {
            console.warn("DB Updated, but SMTP gateway is missing. Cannot send email.");
            return NextResponse.json({ success: true, emailSent: false });
        }

        // 3. Setup NodeMailer
        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: 587,
            secure: false,
            auth: { user: settings.smtp_user, pass: settings.smtp_pass }
        });

        // 4. Generate Email Content based on Decision
        const isApproved = status === 'ACTIVE';
        const subject = isApproved
            ? `✅ Application Approved: Welcome to ${settings.platform_name}!`
            : `❌ Application Update Required: ${shopName}`;

        const htmlContent = isApproved ? `
            <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #051424; color: #ffffff;">
                <h1 style="color: #10b981; text-align: center;">Welcome to ${settings.platform_name}!</h1>
                <p style="color: #d4e4fa;">Hello <strong>${ownerName}</strong>,</p>
                <p style="color: #d4e4fa;">Great news! Your regulatory documents for <strong>${shopName}</strong> have been verified and your platform account is now <strong>ACTIVE</strong>.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" style="background-color: #10b981; color: #051424; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px;">Login to Dashboard</a>
                </div>
                <p style="color: #d4e4fa;">Welcome aboard.</p>
            </div>
        ` : `
            <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #051424; color: #ffffff;">
                <h1 style="color: #ef4444; text-align: center;">Application Status Update</h1>
                <p style="color: #d4e4fa;">Hello <strong>${ownerName}</strong>,</p>
                <p style="color: #d4e4fa;">Our central administration team has reviewed the application for <strong>${shopName}</strong>. Unfortunately, we cannot approve the account at this time.</p>
                
                <div style="background-color: #0d1c2d; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; color: #bdcabc; font-size: 12px; text-transform: uppercase;">Reason for rejection:</p>
                    <p style="margin: 5px 0 0 0; color: #ffffff;">${rejectionReason}</p>
                </div>
                
                <p style="color: #d4e4fa;">Please resolve the issue mentioned above and contact support to reopen your application.</p>
            </div>
        `;

        console.log("X-RAY REVIEW EMAIL:", {
            foundEmail: ownerEmail,
            shopName: shopName,
            status: status
        });

        // 5. Send the Email
        if (ownerEmail) {
            transporter.sendMail({
                from: `"${settings.platform_name} Admin" <${settings.smtp_user}>`,
                to: ownerEmail,
                subject: subject,
                html: htmlContent
            }).catch(emailErr => {
                // We catch errors here silently so it doesn't crash the server in the background
                console.error("Background Email Dispatch Failed:", emailErr);
            });
        }

        return NextResponse.json({ success: true, emailSent: !!ownerEmail });
    } catch (error: any) {
        console.error("Shop Review API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}