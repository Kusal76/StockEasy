import { createClient } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { redirect } from "next/navigation";
import SuperAdminClientView, { AdminData, AuditLogData } from "./client-view";
import { ShieldAlert } from "lucide-react";

export const metadata = {
    title: "Super Admin Control | StockEasy",
};

export default async function SuperAdminPage() {
    const supabase = await createClient();

    // 1. Verify Authentication & Handle Rate Limits gracefully
    let user = null;
    try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) {
            if (authError.status === 429) {
                return (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4 sm:p-6">
                        <ShieldAlert className="w-10 h-10 sm:w-12 sm:h-12 text-warning mb-4 animate-pulse" />
                        <h2 className="text-lg sm:text-xl font-bold mb-2">Rate Limit Reached</h2>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
                            The system is currently cooling down due to high traffic. <br />
                            Please wait 60 seconds and refresh the page.
                        </p>
                    </div>
                );
            }
            throw authError;
        }
        user = data?.user;
    } catch (e) {
        redirect("/login");
    }

    if (!user) redirect("/login");

    // 2. Verify Super Admin Clearance
    const { data: profile } = await supabaseAdmin
        .from("platform_admins")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

    if (!profile || profile.role !== "SUPERADMIN" || !profile.is_active) {
        redirect("/admin");
    }

    // 3. Fetch all Admin Employees
    const { data: rawAdmins } = await supabaseAdmin
        .from("platform_admins")
        .select("*")
        .neq("id", user.id)
        .in("role", ["ADMIN", "SUPERADMIN"])
        .order("created_at", { ascending: false });

    // 4. Fetch the latest Audit Logs
    const { data: rawLogs } = await supabaseAdmin
        .from("admin_audit_logs")
        .select(`
            id,
            action_type,
            target_id,
            details,
            created_at,
            platform_admins (
                full_name,
                role
            )
        `)
        .order("created_at", { ascending: false })
        .limit(50);

    // 5. Strictly format the data to match the Client Component's expectations
    const safeAdmins: AdminData[] = (rawAdmins || []).map((admin: any) => ({
        id: admin.id,
        full_name: admin.full_name,
        role: admin.role,
        is_active: admin.is_active
    }));

    const safeLogs: AuditLogData[] = (rawLogs || []).map((log: any) => ({
        id: log.id,
        action_type: log.action_type,
        details: log.details || "",
        created_at: log.created_at,
        admin: {
            full_name: log.platform_admins?.full_name || 'System Auto',
            role: log.platform_admins?.role || 'SYSTEM'
        }
    }));

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-4 space-y-6 sm:space-y-8 animate-in fade-in duration-500 transition-colors">

            {/* Header - Stacks elements cleanly on mobile views */}
            <div className="flex flex-col sm:flex-row items-start gap-4 border-b border-border pb-6">
                <div className="p-3 bg-destructive/10 rounded-xl shrink-0 self-start sm:self-center shadow-sm">
                    <ShieldAlert className="w-6 h-6 sm:w-8 sm:h-8 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                        Super Admin Control Center
                    </h1>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl font-medium">
                        Global security overrides, administrative audits, and employee management.
                    </p>
                </div>
            </div>

            <SuperAdminClientView
                initialAdmins={safeAdmins}
                initialLogs={safeLogs}
            />
        </div>
    );
}