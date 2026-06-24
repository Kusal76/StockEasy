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
        const { email, name, displayId, originalMessage, adminReply, adminName } = body;

        console.log(`🚀 QStash Worker: Processing support reply for ticket ${displayId}...`);

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

        // 3. Send the Email (Using AWAIT so the serverless function doesn't kill it)
        await transporter.sendMail({
            from: `"${settings.platform_name} Support" <${settings.smtp_user}>`,
            to: email,
            subject: `Re: Support Ticket [${displayId}] - Resolved`,
            html: `
                <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #3e4a3f; border-radius: 10px; background-color: #051424; color: #ffffff;">
                    <h2 style="color: #10b981; text-align: center;">Ticket Resolved</h2>
                    <p style="color: #d4e4fa;">Hello <strong>${name}</strong>,</p>
                    <p style="color: #d4e4fa;">Our team has reviewed your ticket (<strong>${displayId}</strong>) and provided a resolution below:</p>
                    
                    <div style="background-color: #10b98115; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0 0 8px 0; color: #10b981; font-size: 12px; font-weight: bold; text-transform: uppercase;">Support Response (by ${adminName}):</p>
                        <p style="margin: 0; color: #ffffff; white-space: pre-wrap; line-height: 1.5;">${adminReply}</p>
                    </div>

                    <div style="background-color: #0d1c2d; padding: 15px; border-left: 4px solid #3e4a3f; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0 0 8px 0; color: #bdcabc; font-size: 12px; text-transform: uppercase;">Your Original Message:</p>
                        <p style="margin: 0; color: #94a3b8; font-size: 13px; white-space: pre-wrap; font-style: italic;">"${originalMessage}"</p>
                    </div>

                    <p style="color: #d4e4fa; margin-top: 30px;">If you need further assistance, feel free to submit a new ticket from your dashboard.</p>
                    <p style="color: #bdcabc; font-size: 12px;">Best regards,<br/>The ${settings.platform_name} Team</p>
                </div>
            `
        });

        console.log(`✅ Admin reply email sent successfully to ${email}`);

        // Return 200 OK so QStash knows the job is complete
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("QStash Worker Error:", error);
        // Returning a 500 triggers QStash to retry later
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Wrap with signature verifier to ensure ONLY QStash can call this
export const POST = verifySignatureAppRouter(handler);