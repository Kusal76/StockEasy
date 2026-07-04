import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin to bypass RLS and access the Storage bucket
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        // 1. Security Check: Ensure the user triggering this is an Admin (Implement your auth check here)

        // 2. Extract Data (The Snapshot Process)
        // Fetch all critical tables you want to back up concurrently for speed
        const [
            { data: settingsData },
            { data: usersData },
            { data: shopsData },
            { data: inventoryData },
            { data: billsData },
            { data: billItemsData },
            { data: supportTicketsData },
            { data: platformAdminsData },
            { data: auditLogsData }
        ] = await Promise.all([
            supabaseAdmin.from('platform_settings').select('*'),
            supabaseAdmin.from('users').select('*'),
            supabaseAdmin.from('shops').select('*'),
            supabaseAdmin.from('inventory').select('*'),
            supabaseAdmin.from('bills').select('*'),
            supabaseAdmin.from('bill_items').select('*'),
            supabaseAdmin.from('support_tickets').select('*'),
            supabaseAdmin.from('platform_admins').select('*'),
            supabaseAdmin.from('admin_audit_logs').select('*')
        ]);

        // 3. Package the data into a single JSON structure
        const dbSnapshot = {
            metadata: {
                environment: "production",
                timestamp: new Date().toISOString(),
                total_tables_backed_up: 9
            },
            tables: {
                platform_settings: settingsData,
                users: usersData,
                shops: shopsData,
                inventory: inventoryData,
                bills: billsData,
                bill_items: billItemsData,
                support_tickets: supportTicketsData,
                platform_admins: platformAdminsData,
                admin_audit_logs: auditLogsData
            }
        };

        // Convert the object into a formatted JSON string
        const fileContent = JSON.stringify(dbSnapshot, null, 2);

        // Generate a unique filename using the current date/time
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `db-snapshot-${timestamp}.json`;

        // 4. Upload to Supabase Storage (The 'backups' bucket)
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('backups')
            .upload(fileName, fileContent, {
                contentType: 'application/json',
                upsert: false // Don't overwrite existing backups
            });

        if (uploadError) {
            console.error("Storage Upload Error:", uploadError);
            throw new Error(`Failed to save to storage: ${uploadError.message}`);
        }

        return NextResponse.json({
            success: true,
            message: `Snapshot secured! Saved as ${fileName} in your Storage Bucket.`
        });

    } catch (error: any) {
        console.error("❌ SNAPSHOT ENGINE FAILED:", error);
        return NextResponse.json({ error: error.message || "Failed to trigger backup" }, { status: 500 });
    }
}