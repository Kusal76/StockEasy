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

        // Include full_name in the query so we can build the signature
        const { data: adminProfile } = await supabaseAdmin
            .from('platform_admins')
            .select('role, is_active, full_name')
            .eq('id', user.id)
            .maybeSingle();

        if (!adminProfile || !adminProfile.is_active) {
            return NextResponse.json({ error: "Forbidden: Admin clearance required." }, { status: 403 });
        }
        // -------------------------

        const { dbId, displayId, email, name, originalMessage, adminReply } = await req.json();

        if (!dbId || !email || !adminReply) {
            return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
        }

        // GENERATE THE SIGNATURE (e.g., "Kusal Dey (1234abcd)")
        const shortUUID = user.id.substring(0, 8);
        const adminName = adminProfile.full_name || "Platform Admin";
        const adminSignature = `${adminName} (${shortUUID})`;

        // 1. Update the database: ONLY if it is currently OPEN
        const { data: updatedTicket, error: dbError } = await supabaseAdmin
            .from('support_tickets')
            .update({
                status: 'RESOLVED',
                admin_reply: adminReply,
                resolved_by: adminSignature
            })
            .eq('id', dbId)
            .eq('status', 'OPEN') // THE SHIELD: Prevent overwriting resolved tickets
            .select('id')
            .maybeSingle();

        if (dbError) throw new Error("Database error during ticket update.");

        if (!updatedTicket) {
            return NextResponse.json({
                error: "Collision Detected: Another administrator has already resolved this ticket."
            }, { status: 409 });
        }

        if (dbError) throw new Error("Failed to update ticket and save reply.");

        // 2. Fetch Live SMTP Settings
        const { data: settings } = await supabaseAdmin
            .from('platform_settings')
            .select('smtp_host, smtp_user, smtp_pass, platform_name')
            .eq('id', 1)
            .single();

        if (settings && settings.smtp_host && settings.smtp_pass) {
            const transporter = nodemailer.createTransport({
                host: settings.smtp_host,
                port: 587,
                secure: false,
                auth: { user: settings.smtp_user, pass: settings.smtp_pass }
            });

            // 3. AWAIT: Send the Resolution Email to the User (Forces Server to wait)
            try {
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
                console.log("Admin reply email sent.");
            } catch (err) {
                console.error("Failed to send admin reply email:", err);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Reply API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}