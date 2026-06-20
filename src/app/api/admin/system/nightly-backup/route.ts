import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
    try {
        // 1. Verify this request is actually coming from Vercel Cron (Security)
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Check the Admin Toggle
        const { data: settings } = await supabaseAdmin
            .from('platform_settings')
            .select('auto_backup')
            .eq('id', 1)
            .single();

        // If the toggle is OFF, stop right here.
        if (!settings?.auto_backup) {
            return NextResponse.json({ message: "Automated backups are currently disabled in Admin settings." });
        }

        // 3. RUN THE BACKUP ENGINE (Same as our manual script)
        const { data: settingsData } = await supabaseAdmin.from('platform_settings').select('*');
        const { data: usersData } = await supabaseAdmin.from('users').select('*');

        const dbSnapshot = {
            metadata: { type: "automated_nightly", timestamp: new Date().toISOString() },
            tables: { platform_settings: settingsData, users: usersData }
        };

        const fileName = `nightly-backup-${new Date().toISOString().split('T')[0]}.json`;

        await supabaseAdmin.storage.from('backups').upload(fileName, JSON.stringify(dbSnapshot, null, 2), {
            contentType: 'application/json',
            upsert: false
        });

        return NextResponse.json({ success: true, message: `Nightly backup ${fileName} completed.` });

    } catch (error: any) {
        console.error("Nightly Backup Failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}