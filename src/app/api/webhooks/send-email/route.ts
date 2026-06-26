import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This is the actual worker function
async function handler(req: Request) {
    try {
        const body = await req.json();
        const { ownerEmail, ownerName, shopName, status, rejectionReason, baseUrl } = body;

        console.log(`🚀 QStash Worker: Processing email for ${shopName}...`);

        // 1. Fetch live SMTP Settings
        const { data: settings } = await supabaseAdmin
            .from('platform_settings')
            .select('smtp_host, smtp_user, smtp_pass, platform_name')
            .eq('id', 1)
            .single();

        if (!settings || !settings.smtp_host || !settings.smtp_pass) {
            throw new Error("SMTP gateway is missing. Cannot send email.");
        }

        // 2. Setup NodeMailer
        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: 587,
            secure: false,
            auth: { user: settings.smtp_user, pass: settings.smtp_pass }
        });

        // 3. Generate Email Content based on Decision
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
                    <a href="${baseUrl}/login" style="background-color: #10b981; color: #051424; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px;">Login to Dashboard</a>
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
                
                <p style="color: #d4e4fa;">Please resolve the issue mentioned above and register again.</p>
            </div>
        `;

        // 4. Send the Email (Using AWAIT so the serverless function doesn't kill it)
        await transporter.sendMail({
            from: `"${settings.platform_name} Admin" <kusaldey2027@gmail.com>`,
            to: ownerEmail,
            subject: subject,
            html: htmlContent
        });

        console.log(`✅ Email sent successfully to ${ownerEmail}`);

        // Return 200 OK so QStash knows the job is complete
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("QStash Worker Error:", error);
        // By returning a 500 error, QStash will automatically retry the job later!
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Wrap the handler with the Upstash signature verifier to ensure ONLY QStash can call this endpoint
export const POST = verifySignatureAppRouter(handler);