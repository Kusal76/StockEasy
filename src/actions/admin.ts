"use server";

import { createClient } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function suspendAdminAccount(adminIdToSuspend: string, reason: string) {
    const supabaseUserClient = await createClient();
    const { data: { user }, error: sessionError } = await supabaseUserClient.auth.getUser();

    if (sessionError || !user) throw new Error("Authentication failed.");

    // 1. Look inside the new vault table to verify YOU are a Super Admin
    const { data: callerProfile, error: profileError } = await supabaseAdmin
        .from("platform_admins")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

    if (profileError || !callerProfile || callerProfile.role !== "SUPERADMIN" || !callerProfile.is_active) {
        await supabaseAdmin.from("admin_audit_logs").insert({
            admin_id: user.id,
            action_type: "UNAUTHORIZED_BREACH_ATTEMPT",
            target_id: adminIdToSuspend,
            details: `Unauthorized suspension attempt.`
        });
        throw new Error("Critical Security Warning: Unauthorized operations logged.");
    }

    // 2. Suspend the target inside the vault table
    const { error: updateError } = await supabaseAdmin
        .from("platform_admins")
        .update({ is_active: false })
        .eq("id", adminIdToSuspend);

    if (updateError) throw new Error("Failed to suspend account.");

    // 3. Write the permanent audit log
    await supabaseAdmin.from("admin_audit_logs").insert({
        admin_id: user.id,
        action_type: "SUSPEND_ADMIN_SUCCESS",
        target_id: adminIdToSuspend,
        details: `Suspended. Reason: ${reason}`
    });

    // 4. Force the Next.js cache to instantly refresh the Super Admin page!
    revalidatePath("/admin/super-admin");

    return { success: true, message: "Platform admin suspended successfully." };
}

export async function restoreAdminAccount(adminIdToRestore: string, reason: string) {
    const supabaseUserClient = await createClient();
    const { data: { user }, error: sessionError } = await supabaseUserClient.auth.getUser();

    if (sessionError || !user) throw new Error("Authentication failed.");

    // 1. Verify YOU are a Super Admin
    const { data: callerProfile, error: profileError } = await supabaseAdmin
        .from("platform_admins")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

    if (profileError || !callerProfile || callerProfile.role !== "SUPERADMIN" || !callerProfile.is_active) {
        throw new Error("Critical Security Warning: Unauthorized operations logged.");
    }

    // 2. Reactivate the target inside the vault table
    const { error: updateError } = await supabaseAdmin
        .from("platform_admins")
        .update({ is_active: true }) // Set back to true!
        .eq("id", adminIdToRestore);

    if (updateError) throw new Error("Failed to restore account.");

    // 3. Write the permanent audit log
    await supabaseAdmin.from("admin_audit_logs").insert({
        admin_id: user.id,
        action_type: "RESTORE_ADMIN_SUCCESS",
        target_id: adminIdToRestore,
        details: `Restored. Reason: ${reason}`
    });

    // 4. Force UI refresh
    revalidatePath("/admin/super-admin");

    return { success: true, message: "Platform admin restored successfully." };
}

export async function provisionAdminAccount(formData: FormData) {
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;

    if (!fullName || !email || !role) throw new Error("All fields are required.");

    const supabaseUserClient = await createClient();
    const { data: { user }, error: sessionError } = await supabaseUserClient.auth.getUser();

    if (sessionError || !user) throw new Error("Authentication failed.");

    // 1. Verify YOU are a Super Admin
    const { data: callerProfile, error: profileError } = await supabaseAdmin
        .from("platform_admins")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

    if (profileError || !callerProfile || callerProfile.role !== "SUPERADMIN" || !callerProfile.is_active) {
        throw new Error("Critical Security Warning: Unauthorized operations logged.");
    }

    // 2. Generate a secure temporary password
    const tempPassword = `StockEasy${Math.floor(1000 + Math.random() * 9000)}!`;

    // 3. Silently create the user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true // Auto-confirm so they can log in immediately
    });

    if (authError) throw new Error(`Auth Error: ${authError.message}`);
    if (!authData.user) throw new Error("Failed to generate user.");

    // 4. Create their vault profile
    const { error: dbError } = await supabaseAdmin
        .from("platform_admins")
        .insert({
            id: authData.user.id,
            email: email,
            full_name: fullName,
            role: role,
            is_active: true
        });

    if (dbError) {
        // Log the exact Postgres error to the terminal
        console.error("SUPABASE DB ERROR DETAILS:", dbError);

        // Rollback
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

        // Throw the real error message to the UI
        throw new Error(`Database Error: ${dbError.message}`);
    }

    // 5. Write the permanent audit log
    await supabaseAdmin.from("admin_audit_logs").insert({
        admin_id: user.id,
        action_type: "PROVISION_ADMIN_SUCCESS",
        target_id: authData.user.id,
        details: `Provisioned new ${role}: ${email}`
    });

    // 6. Force UI refresh
    revalidatePath("/admin/super-admin");

    return { success: true, email, tempPassword, message: "Admin successfully provisioned." };
}

export async function setupPermanentPassword(formData: FormData) {
    const newPassword = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!newPassword || newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters long.");
    }
    if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match.");
    }

    const supabaseUserClient = await createClient();
    const { data: { user }, error: sessionError } = await supabaseUserClient.auth.getUser();

    if (sessionError || !user) throw new Error("Authentication failed.");

    // 1. Update the password in Supabase Auth
    const { error: authError } = await supabaseUserClient.auth.updateUser({
        password: newPassword
    });

    if (authError) throw new Error(`Failed to update password: ${authError.message}`);

    // 2. Clear the 'requires_password_change' flag in the vault
    const { error: dbError } = await supabaseAdmin
        .from("platform_admins")
        .update({ requires_password_change: false })
        .eq("id", user.id);

    if (dbError) throw new Error("Password updated, but failed to clear security flag.");

    // 3. Log the action
    await supabaseAdmin.from("admin_audit_logs").insert({
        admin_id: user.id,
        action_type: "ADMIN_SETUP_COMPLETE",
        target_id: user.id,
        details: "Admin successfully set their permanent password."
    });

    return { success: true };
}