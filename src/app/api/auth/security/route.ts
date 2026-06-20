import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { email, action } = await req.json();

        // 1. Fetch Global Settings
        const { data: settings } = await supabaseAdmin
            .from('platform_settings')
            .select('max_login_attempts, require_2fa, maintenance_mode')
            .eq('id', 1)
            .single();

        // 2. Fetch User by Email
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('id, failed_login_attempts, account_locked_until, role')
            .eq('email', email)
            .single();

        if (!user) return NextResponse.json({ success: true, settings }); // Don't leak if user doesn't exist

        const now = new Date();
        const lockedUntil = user.account_locked_until ? new Date(user.account_locked_until) : null;
        const isLocked = lockedUntil && lockedUntil > now;

        // Action: PRE-CHECK (Before login attempt)
        if (action === 'check') {
            if (isLocked) {
                const minutesLeft = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
                return NextResponse.json({ locked: true, minutesLeft, settings });
            }
            return NextResponse.json({ locked: false, settings, role: user.role });
        }

        // Action: RECORD FAILURE
        if (action === 'fail') {
            if (isLocked) return NextResponse.json({ locked: true }); // Already locked

            const newAttempts = (user.failed_login_attempts || 0) + 1;
            const maxAttempts = settings?.max_login_attempts || 5;

            if (newAttempts >= maxAttempts) {
                // Lock out for 15 minutes
                const lockTime = new Date(now.getTime() + 15 * 60000).toISOString();
                await supabaseAdmin.from('users').update({
                    failed_login_attempts: newAttempts,
                    account_locked_until: lockTime
                }).eq('id', user.id);
                return NextResponse.json({ locked: true, minutesLeft: 15 });
            } else {
                await supabaseAdmin.from('users').update({ failed_login_attempts: newAttempts }).eq('id', user.id);
                return NextResponse.json({ locked: false, attemptsLeft: maxAttempts - newAttempts });
            }
        }

        // Action: RECORD SUCCESS
        if (action === 'success') {
            // Reset attempts on successful login
            await supabaseAdmin.from('users').update({
                failed_login_attempts: 0,
                account_locked_until: null
            }).eq('id', user.id);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}