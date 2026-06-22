"use client";

import { useState } from "react";
import { suspendAdminAccount, restoreAdminAccount, provisionAdminAccount } from "@/actions/admin";
import { ShieldBan, ShieldCheck, AlertTriangle, Activity, UserCog, Loader2, Clock, UserPlus, KeyRound } from "lucide-react";

export interface AdminData {
    id: string;
    full_name: string;
    role: string;
    is_active: boolean;
}

export interface AuditLogData {
    id: string;
    action_type: string;
    details: string;
    created_at: string;
    admin: {
        full_name: string;
        role: string;
    };
}

export default function SuperAdminClientView({
    initialAdmins,
    initialLogs
}: {
    initialAdmins: AdminData[];
    initialLogs: AuditLogData[];
}) {
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [showProvisionForm, setShowProvisionForm] = useState(false);
    const [newCredentials, setNewCredentials] = useState<{ email: string, pass: string } | null>(null);

    const handleSuspend = async (adminId: string, adminName: string) => {
        if (!window.confirm(`CRITICAL WARNING: Are you sure you want to permanently revoke system access for ${adminName}?`)) return;
        setIsProcessing(adminId);
        setError("");
        try {
            const result = await suspendAdminAccount(adminId, "Revoked by Super Admin via Control Center");
            if (result.success) window.location.reload();
        } catch (err: any) { setError(err.message); } finally { setIsProcessing(null); }
    };

    const handleRestore = async (adminId: string, adminName: string) => {
        if (!window.confirm(`Are you sure you want to restore system access for ${adminName}?`)) return;
        setIsProcessing(adminId);
        setError("");
        try {
            const result = await restoreAdminAccount(adminId, "Restored by Super Admin via Control Center");
            if (result.success) window.location.reload();
        } catch (err: any) { setError(err.message); } finally { setIsProcessing(null); }
    };

    const handleProvision = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsProcessing("provisioning");
        setError("");
        setNewCredentials(null);

        const formData = new FormData(e.currentTarget);
        try {
            const result = await provisionAdminAccount(formData);
            if (result.success && result.tempPassword) {
                setNewCredentials({ email: result.email, pass: result.tempPassword });
                setShowProvisionForm(false);
                (e.target as HTMLFormElement).reset();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsProcessing(null);
        }
    };

    const getBadgeStyle = (actionType: string) => {
        if (actionType.includes("UNAUTHORIZED") || actionType.includes("SUSPEND")) return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
        if (actionType.includes("RESTORE") || actionType.includes("SUCCESS")) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">

                {/* Credentials Alert Modal (Shows only when a new user is created) */}
                {newCredentials && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2 mb-2">
                            <KeyRound className="w-5 h-5" /> Provisioning Successful
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Please securely copy these credentials and provide them to the new employee. This password will not be shown again.
                        </p>
                        <div className="bg-background rounded-lg p-4 border border-border font-mono text-sm space-y-2">
                            <div><span className="text-muted-foreground">Email:</span> <span className="font-bold">{newCredentials.email}</span></div>
                            <div><span className="text-muted-foreground">Temp Password:</span> <span className="font-bold">{newCredentials.pass}</span></div>
                        </div>
                        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold w-full hover:bg-primary/90 transition-colors">
                            Acknowledge & Refresh Dashboard
                        </button>
                    </div>
                )}

                <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <UserCog className="w-5 h-5 text-primary" /> Administrative Employees
                        </h2>
                        <button
                            onClick={() => setShowProvisionForm(!showProvisionForm)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
                        >
                            <UserPlus className="w-4 h-4" /> Add Admin
                        </button>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    {showProvisionForm && (
                        <form onSubmit={handleProvision} className="mb-6 p-4 bg-muted/30 border border-border rounded-xl space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Name</label>
                                    <input required name="fullName" type="text" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Jane Doe" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
                                    <input required name="email" type="email" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="jane@stockeasy.com" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Clearance Level</label>
                                <select required name="role" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                    <option value="ADMIN">Standard Support Agent (ADMIN)</option>
                                    <option value="SUPERADMIN">Master Control (SUPERADMIN)</option>
                                </select>
                            </div>
                            <button disabled={isProcessing === "provisioning"} type="submit" className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                {isProcessing === "provisioning" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate Credentials"}
                            </button>
                        </form>
                    )}

                    <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                        {initialAdmins.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">No other admins found.</div>
                        ) : (
                            initialAdmins.map((admin) => (
                                <div key={admin.id} className="p-4 flex items-center justify-between bg-background hover:bg-muted/30 transition-colors">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">{admin.full_name}</span>
                                            {!admin.is_active && (
                                                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase bg-destructive/10 text-destructive rounded-full tracking-wider">Suspended</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-muted-foreground font-mono mt-1">Role: {admin.role}</div>
                                    </div>

                                    {admin.is_active ? (
                                        <button onClick={() => handleSuspend(admin.id, admin.full_name)} disabled={isProcessing === admin.id} className="flex items-center gap-2 px-4 py-2 bg-destructive/10 hover:bg-destructive text-destructive hover:text-white border border-destructive/20 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50">
                                            {isProcessing === admin.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldBan className="w-4 h-4" />}
                                            Revoke Access
                                        </button>
                                    ) : (
                                        <button onClick={() => handleRestore(admin.id, admin.full_name)} disabled={isProcessing === admin.id} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-500/20 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-50">
                                            {isProcessing === admin.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                            Restore Access
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column: Audit Logs */}
            <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl shadow-sm p-6 h-[600px] flex flex-col">
                    <div className="mb-6 pb-4 border-b border-border">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" /> System Audit Logs
                        </h2>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 relative">
                        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/60 z-0"></div>
                        <div className="space-y-6 relative z-10">
                            {initialLogs.map((log) => (
                                <div key={log.id} className="flex gap-4 group">
                                    <div className="mt-1.5 flex-shrink-0 w-[30px] h-[30px] rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-sm">
                                        <div className="w-2 h-2 rounded-full bg-primary group-hover:scale-125 transition-transform"></div>
                                    </div>
                                    <div className="flex-1 bg-background hover:bg-muted/20 border border-border rounded-xl p-4 transition-colors shadow-sm">
                                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 mb-3">
                                            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-md w-fit ${getBadgeStyle(log.action_type)}`}>
                                                {log.action_type.replace(/_/g, ' ')}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                                                <Clock className="w-3 h-3" />
                                                {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-sm font-semibold text-foreground mb-1">{log.admin.full_name}</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{log.details}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}