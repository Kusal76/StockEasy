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
        const { staffEmail, staffName, shopName, inviteLink } = body;

        console.log(`🚀 QStash Worker: Processing staff invite for ${staffEmail}...`);

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

        // 2. Send the Branded Invite Email
        await transporter.sendMail({
            from: `"${shopName} via ${settings.platform_name}" <${settings.smtp_user}>`,
            to: staffEmail,
            subject: `You have been invited to join ${shopName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #051424; color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h2 style="color: #10b981; margin: 0;">Team Invitation</h2>
                        <p style="color: #bdcabc; font-size: 14px; margin-top: 5px;">${shopName}</p>
                    </div>
                    
                    <p style="color: #d4e4fa; line-height: 1.6;">Hello <strong>${staffName}</strong>,</p>
                    <p style="color: #d4e4fa; line-height: 1.6;">You have been invited to join the staff portal for <strong>${shopName}</strong> on the ${settings.platform_name} operating system.</p>
                    
                    <div style="text-align: center; margin: 40px 0;">
                        <a href="${inviteLink}" style="background-color: #10b981; color: #051424; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 16px; display: inline-block;">Accept Invitation & Setup Account</a>
                    </div>
                    
                    <div style="background-color: #0d1c2d; padding: 15px; border-left: 4px solid #3e4a3f; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #94a3b8; font-size: 12px;"><strong>Note:</strong> This invite link is secure and will expire in 24 hours. If you did not expect this invitation, you can safely ignore this email.</p>
                    </div>
                </div>
            `
        });

        console.log(`✅ Staff invite email dispatched to ${staffEmail}`);
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("QStash Worker Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Enforce signature verification
export const POST = verifySignatureAppRouter(handler);