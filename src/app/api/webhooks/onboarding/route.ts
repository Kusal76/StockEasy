import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handler(req: Request) {
    try {
        const body = await req.json();
        const { email, ownerName, shopName, applicationId } = body;

        console.log(`🚀 QStash Worker: Processing onboarding email for ${shopName}...`);

        // 1. Fetch live SMTP Settings from the database
        const { data: settings } = await supabaseAdmin
            .from('platform_settings')
            .select('smtp_host, smtp_user, smtp_pass, platform_name')
            .eq('id', 1)
            .single();

        if (!settings || !settings.smtp_host || !settings.smtp_pass) {
            throw new Error("SMTP gateway is not configured.");
        }

        // 2. Setup NodeMailer Transport
        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: 587,
            secure: false,
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_pass
            }
        });

        // 3. Dispatch the Email (using await so the worker doesn't die early)
        await transporter.sendMail({
            from: `"${settings.platform_name} Onboarding" <kusaldey2027@gmail.com>`,
            to: email, // <-- ADDED BACK: This fixes the "No recipients defined" error!
            subject: `Application Received: ${shopName} [${applicationId}]`,
            html: `
                <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #051424; color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #10b981; margin: 0;">StockEasy</h1>
                        <p style="color: #bdcabc; font-size: 12px; margin-top: 5px; text-transform: uppercase; letter-spacing: 1px;">Central Onboarding</p>
                    </div>
                    
                    <h2 style="color: #ffffff; border-bottom: 1px solid #3e4a3f; padding-bottom: 10px;">Application Successfully Submitted</h2>
                    <p style="color: #d4e4fa; line-height: 1.6;">Hello <strong>${ownerName}</strong>,</p>
                    <p style="color: #d4e4fa; line-height: 1.6;">Thank you for registering <strong>${shopName}</strong> on our platform.</p>
                    
                    <div style="background-color: #0d1c2d; border: 1px solid #3e4a3f; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #bdcabc; font-size: 12px; text-transform: uppercase;">Application Reference ID</p>
                        <p style="margin: 5px 0 0 0; color: #10b981; font-size: 18px; font-weight: bold; font-family: monospace;">${applicationId}</p>
                    </div>
                    
                    <p style="color: #d4e4fa; line-height: 1.6;">Our central administration team is currently reviewing your submitted regulatory documents (PAN, GST, Drug License). You will receive another email within 24-48 hours once your account is approved or if further information is required.</p>
                    
                    <hr style="border: none; border-top: 1px solid #3e4a3f; margin: 30px 0 20px 0;" />
                    <p style="font-size: 11px; color: #64748b; text-align: center;">This is an automated system message. Please do not reply to this email.</p>
                </div>
            `
        });

        console.log(`✅ Onboarding email sent successfully to ${email}`);
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("QStash Worker Error:", error);
        // Returning 500 tells QStash to retry later if the SMTP server blipped
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Enforce signature verification
export const POST = verifySignatureAppRouter(handler);