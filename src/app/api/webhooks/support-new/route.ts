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
        const { name, email, message, friendlyTicketId } = body;

        console.log(`🚀 QStash Worker: Processing new ticket ${friendlyTicketId}...`);

        // 1. Fetch Live SMTP Settings
        const { data: settings } = await supabaseAdmin
            .from('platform_settings')
            .select('smtp_host, smtp_user, smtp_pass, platform_name')
            .eq('id', 1)
            .single();

        if (!settings || !settings.smtp_host || !settings.smtp_pass) {
            throw new Error("SMTP gateway missing. Cannot send emails.");
        }

        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: 587,
            secure: false,
            auth: { user: settings.smtp_user, pass: settings.smtp_pass }
        });

        // 2. Send User Confirmation Email
        await transporter.sendMail({
            from: `"${settings.platform_name} Support" <${settings.smtp_user}>`,
            to: email,
            subject: `Support Ticket Received: [${friendlyTicketId}]`,
            html: `
                <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #051424; color: #ffffff;">
                    <h2 style="color: #10b981; text-align: center;">We've got your message!</h2>
                    <p style="color: #d4e4fa;">Hello <strong>${name}</strong>,</p>
                    <p style="color: #d4e4fa;">This is a confirmation that our support team has received your request. Your ticket reference is <strong>${friendlyTicketId}</strong>.</p>
                    <div style="background-color: #0d1c2d; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0;">
                        <p style="margin: 0; color: #bdcabc; font-size: 12px; text-transform: uppercase;">Your Message:</p>
                        <p style="margin: 5px 0 0 0; color: #ffffff; white-space: pre-wrap;">${message}</p>
                    </div>
                    <p style="color: #d4e4fa;">Our team will review this and get back to you shortly.</p>
                </div>
            `
        });

        // 3. Send Admin Alert Email
        await transporter.sendMail({
            from: `"${settings.platform_name} System" <${settings.smtp_user}>`,
            to: settings.smtp_user,
            subject: `🚨 New Support Ticket: [${friendlyTicketId}]`,
            html: `
                <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ef4444; border-radius: 10px; background-color: #051424; color: #ffffff;">
                    <h2 style="color: #ef4444;">New Ticket: ${friendlyTicketId}</h2>
                    <p><strong>From:</strong> ${name} (${email})</p>
                    <p><strong>Status:</strong> OPEN</p>
                    <hr style="border-color: #3e4a3f; margin: 20px 0;" />
                    <p style="white-space: pre-wrap; color: #d4e4fa;">${message}</p>
                </div>
            `
        });

        console.log(`✅ Both emails dispatched for ticket ${friendlyTicketId}`);
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("QStash Worker Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Enforce signature verification
export const POST = verifySignatureAppRouter(handler);