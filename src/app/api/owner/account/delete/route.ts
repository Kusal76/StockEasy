import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const supabaseAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(req: Request) {
    try {
        const { shopId, email, password } = await req.json();

        if (!shopId || !email || !password) return NextResponse.json({ error: "Missing required fields." }, { status: 400 });

        // 1. Verify the Owner's Identity
        const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({ email, password });
        if (authError || !authData.user) return NextResponse.json({ error: "Invalid password. Deletion aborted." }, { status: 401 });

        // 2. Calculate the deletion date (30 days from now)
        const deletionDate = new Date();
        deletionDate.setDate(deletionDate.getDate() + 30);

        // 3. Update the Shop Record (The Freeze)
        const { error: updateError } = await supabaseAdmin
            .from('shops')
            .update({ status: 'PENDING_DELETION', scheduled_deletion_date: deletionDate.toISOString() })
            .eq('id', shopId);

        if (updateError) throw new Error("Failed to flag account for deletion.");

        // 4. Fetch SMTP Settings & Send Email (Fire and Forget)
        const { data: settings } = await supabaseAdmin.from('platform_settings').select('*').eq('id', 1).single();

        if (settings && settings.smtp_host && settings.smtp_pass) {
            const transporter = nodemailer.createTransport({
                host: settings.smtp_host, port: 587, secure: false,
                auth: { user: settings.smtp_user, pass: settings.smtp_pass }
            });

            transporter.sendMail({
                from: `"${settings.platform_name} Support" <${settings.smtp_user}>`,
                to: email,
                subject: `Account Deletion Scheduled - ${settings.platform_name}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ef4444; border-radius: 10px; background-color: #051424; color: #ffffff;">
                        <h2 style="color: #ef4444; text-align: center;">Account Scheduled for Deletion</h2>
                        <p style="color: #d4e4fa;">Hello,</p>
                        <p style="color: #d4e4fa;">Your account has been deactivated and successfully scheduled for deletion.</p>
                        <div style="background-color: #0d1c2d; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                            <p style="margin: 0; color: #ffffff;">Your pharmacy data, inventory, and staff accounts will be permanently destroyed on <strong>${deletionDate.toLocaleDateString()}</strong> (30 days from today).</p>
                        </div>
                        <p style="color: #d4e4fa;">If this was a mistake, or you wish to recover your account, please contact platform support immediately.</p>
                    </div>
                `
            }).catch(console.error); // Catch silently
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}