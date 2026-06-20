"use client";

import { useState, useEffect, useRef } from "react";
import {
    Save, Shield, Key, Mail, AlertTriangle, CheckCircle2,
    Loader2, Globe, HardDrive, Smartphone, Send
} from "lucide-react";
import { supabase } from "../../lib/supabase"; // Adjusted path to match standard Next.js structure

type SettingsTab = "general" | "security" | "gateways" | "system";

export default function SuperAdminSettings() {
    const [activeTab, setActiveTab] = useState<SettingsTab>("general");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");

    // Danger Zone States
    const [isClearingCache, setIsClearingCache] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);

    // --- PERSONAL 2FA STATES ---
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [isEnrolling2FA, setIsEnrolling2FA] = useState(false);
    const [qrCodeSvg, setQrCodeSvg] = useState("");
    const [factorId, setFactorId] = useState("");
    const [verifyCode, setVerifyCode] = useState("");
    const [isVerifying2FA, setIsVerifying2FA] = useState(false);

    // --- SMTP TEST STATES ---
    const [isTestingSMTP, setIsTestingSMTP] = useState(false);
    const [testRecipient, setTestRecipient] = useState("");

    // Global Settings State
    const [settings, setSettings] = useState({
        platformName: "StockEasy",
        supportEmail: "support@stockeasy.in",
        maintenanceMode: false,
        onboardingEnabled: true,
        require2FA: true,
        sessionTimeoutHours: 12,
        maxLoginAttempts: 5,
        smtpHost: "smtp.postmarkapp.com",
        smtpUser: "apikey",
        smtpPass: "", // <-- NEW FIELD
        logRetentionDays: 90,
        autoBackup: true
    });

    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useEffect(() => {
        fetchSettingsAndSecurity();
    }, []);

    const fetchSettingsAndSecurity = async () => {
        try {
            // 1. Fetch Global Settings
            const res = await fetch('/api/admin/settings');
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            if (data.settings) {
                setSettings({
                    platformName: data.settings.platform_name || "StockEasy",
                    supportEmail: data.settings.support_email || "",
                    maintenanceMode: data.settings.maintenance_mode || false,
                    onboardingEnabled: data.settings.onboarding_enabled ?? true,
                    require2FA: data.settings.require_2fa ?? true,
                    sessionTimeoutHours: data.settings.session_timeout_hours || 12,
                    maxLoginAttempts: data.settings.max_login_attempts || 5,
                    smtpHost: data.settings.smtp_host || "",
                    smtpUser: data.settings.smtp_user || "",
                    smtpPass: data.settings.smtp_pass || "", // <-- NEW FIELD MAP
                    logRetentionDays: data.settings.log_retention_days || 90,
                    autoBackup: data.settings.auto_backup ?? true
                });
            }

            // 2. Fetch Personal MFA Status
            const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
            if (!factorsError && factorsData) {
                const hasVerifiedTOTP = factorsData.totp.some(
                    (f: any) => f.status === 'verified'
                );
                setIs2FAEnabled(hasVerifiedTOTP);
            }

        } catch (error) {
            console.error("Error fetching platform settings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- 2FA ENROLLMENT LOGIC ---
    const handleStart2FAEnrollment = async () => {
        setIsEnrolling2FA(true);
        try {
            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
            });
            if (error) throw error;

            setQrCodeSvg(data.totp.qr_code);
            setFactorId(data.id);
        } catch (error: any) {
            alert("Failed to initialize 2FA: " + error.message);
            setIsEnrolling2FA(false);
        }
    };

    const handleVerify2FAEnrollment = async () => {
        if (verifyCode.length !== 6) return alert("Code must be 6 digits.");
        setIsVerifying2FA(true);

        try {
            const { error } = await supabase.auth.mfa.challengeAndVerify({
                factorId: factorId,
                code: verifyCode,
            });

            if (error) throw error;

            setIs2FAEnabled(true);
            setQrCodeSvg("");
            setFactorId("");
            setVerifyCode("");
            alert("Success! 2FA is now permanently linked to your account.");
        } catch (error: any) {
            alert("Invalid verification code. Please try again.");
        } finally {
            setIsVerifying2FA(false);
        }
    };

    const handleChange = (key: keyof typeof settings, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setHasUnsavedChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveMessage("");

        try {
            const payload = {
                platform_name: settings.platformName,
                support_email: settings.supportEmail,
                maintenance_mode: settings.maintenanceMode,
                onboarding_enabled: settings.onboardingEnabled,
                require_2fa: settings.require2FA,
                session_timeout_hours: settings.sessionTimeoutHours,
                max_login_attempts: settings.maxLoginAttempts,
                smtp_host: settings.smtpHost,
                smtp_user: settings.smtpUser,
                smtp_pass: settings.smtpPass, // <-- NEW FIELD PAYLOAD
                log_retention_days: settings.logRetentionDays,
                auto_backup: settings.autoBackup
            };

            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to save settings");

            setHasUnsavedChanges(false);
            setSaveMessage("Settings synchronized securely.");
            setTimeout(() => setSaveMessage(""), 4000);
        } catch (error: any) {
            console.error("Save error:", error);
            alert("Failed to save settings: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // --- NEW: TEST SMTP CONNECTION ---
    const handleTestSMTP = async () => {
        if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass || !testRecipient) {
            return alert("Please provide the SMTP Host, User, Password, and a valid Recipient Email before testing.");
        }

        setIsTestingSMTP(true);
        try {
            const res = await fetch('/api/admin/settings/test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: settings.smtpHost,
                    user: settings.smtpUser,
                    pass: settings.smtpPass,
                    to: testRecipient
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to establish SMTP connection.");

            alert("Success! A test email has been dispatched to " + testRecipient);
            setTestRecipient(""); // clear on success
        } catch (error: any) {
            console.error("SMTP Test Error:", error);
            alert("SMTP Test Failed: " + error.message);
        } finally {
            setIsTestingSMTP(false);
        }
    };

    const handleClearCache = async () => {
        if (!window.confirm("WARNING: Purging the system cache will force all edge nodes to re-fetch from the database. This may cause a temporary latency spike. Proceed?")) return;

        setIsClearingCache(true);
        try {
            // Hit the new Next.js Cache Purge API
            const res = await fetch('/api/admin/system/purge-cache', {
                method: 'POST',
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to purge cache.");

            alert("Success: " + data.message);
        } catch (error: any) {
            console.error("Cache purge error:", error);
            alert("Failed to communicate with cache servers: " + error.message);
        } finally {
            setIsClearingCache(false);
        }
    };

    const handleManualBackup = async () => {
        if (!window.confirm("Trigger an immediate out-of-schedule database snapshot? This will consume backup storage allocation.")) return;

        setIsBackingUp(true);
        try {
            // Hit the new Backup API Route
            const res = await fetch('/api/admin/system/backup', {
                method: 'POST',
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to trigger backup.");

            alert("Success: " + data.message);
        } catch (error: any) {
            console.error("Backup error:", error);
            alert("Failed to communicate with backup servers: " + error.message);
        } finally {
            setIsBackingUp(false);
        }
    };

    const Toggle = ({ isOn, onToggle }: { isOn: boolean, onToggle: () => void }) => (
        <div
            onClick={onToggle}
            className={`w-12 h-6 rounded-full transition-colors cursor-pointer relative ${isOn ? 'bg-[#10b981]' : 'bg-muted border border-border'}`}
        >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-[3px] transition-all ${isOn ? 'left-[26px]' : 'left-1'}`} />
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-muted-foreground transition-colors">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#10b981]" />
                <p className="font-mono text-sm tracking-widest uppercase">Fetching System Policies...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl animate-in fade-in duration-500 pb-20 transition-colors">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                        Platform Settings
                        <span className="bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">SuperAdmin Only</span>
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Global configurations, security policies, and API gateways.</p>
                </div>
                <div className="flex items-center gap-4">
                    {saveMessage && (
                        <span className="text-sm font-bold text-[#10b981] animate-in fade-in flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> {saveMessage}
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={!hasUnsavedChanges || isSaving}
                        className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${hasUnsavedChanges ? 'bg-[#10b981] text-white hover:bg-[#10b981]/90 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-card text-muted-foreground border border-border cursor-not-allowed'}`}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSaving ? 'Syncing...' : 'Save Configuration'}
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">

                {/* Vertical Sidebar Navigation */}
                <aside className="w-full lg:w-64 shrink-0 space-y-1">
                    <button onClick={() => setActiveTab("general")} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all cursor-pointer ${activeTab === "general" ? "bg-[#10b981]/10 text-[#10b981] shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                        <Globe className="w-4 h-4" /> General Rules
                    </button>
                    <button onClick={() => setActiveTab("security")} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all cursor-pointer ${activeTab === "security" ? "bg-[#10b981]/10 text-[#10b981] shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                        <Shield className="w-4 h-4" /> Security & Access
                    </button>
                    <button onClick={() => setActiveTab("gateways")} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all cursor-pointer ${activeTab === "gateways" ? "bg-[#10b981]/10 text-[#10b981] shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                        <Key className="w-4 h-4" /> API Gateways
                    </button>
                    <button onClick={() => setActiveTab("system")} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all cursor-pointer ${activeTab === "system" ? "bg-[#10b981]/10 text-[#10b981] shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                        <HardDrive className="w-4 h-4" /> System & Logs
                    </button>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 space-y-6">

                    {/* --- GENERAL SETTINGS --- */}
                    {activeTab === "general" && (
                        <div className="animate-in fade-in space-y-6">
                            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-colors">
                                <div className="p-6 border-b border-border bg-muted/20">
                                    <h2 className="text-lg font-bold text-foreground">Platform Identity</h2>
                                    <p className="text-xs text-muted-foreground mt-1">Core platform variables used across emails and portals.</p>
                                </div>
                                <div className="p-6 space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Platform Name</label>
                                            <input type="text" value={settings.platformName} onChange={(e) => handleChange("platformName", e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 outline-none transition-all shadow-sm" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Global Support Email</label>
                                            <input type="email" value={settings.supportEmail} onChange={(e) => handleChange("supportEmail", e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 outline-none transition-all shadow-sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-colors">
                                <div className="p-6 border-b border-border bg-muted/20">
                                    <h2 className="text-lg font-bold text-foreground">Platform States</h2>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground">Allow New Registrations</h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">Toggle whether new pharmacies can sign up for the platform.</p>
                                        </div>
                                        <Toggle isOn={settings.onboardingEnabled} onToggle={() => handleChange("onboardingEnabled", !settings.onboardingEnabled)} />
                                    </div>
                                    <div className="flex items-center justify-between pt-6 border-t border-border">
                                        <div>
                                            <h3 className="text-sm font-bold text-warning flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4" /> Global Maintenance Mode
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">Locks out all tenants and shows a maintenance screen. Admins bypass this.</p>
                                        </div>
                                        <Toggle isOn={settings.maintenanceMode} onToggle={() => handleChange("maintenanceMode", !settings.maintenanceMode)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- SECURITY SETTINGS --- */}
                    {activeTab === "security" && (
                        <div className="animate-in fade-in space-y-6">

                            {/* Personal Security Setup (Admin 2FA) */}
                            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden relative transition-colors">
                                <div className="absolute top-0 left-0 w-1 h-full bg-[#10b981]"></div>
                                <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                            <Smartphone className="w-5 h-5 text-[#10b981]" /> My Account Security
                                        </h2>
                                        <p className="text-xs text-muted-foreground mt-1">Configure your personal SuperAdmin authentication settings.</p>
                                    </div>
                                    {is2FAEnabled && (
                                        <span className="bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> 2FA Active
                                        </span>
                                    )}
                                </div>
                                <div className="p-6">
                                    {is2FAEnabled ? (
                                        <p className="text-sm text-muted-foreground">Your administrator account is actively protected by cryptographic Two-Factor Authentication. No further action is required.</p>
                                    ) : (
                                        <div className="space-y-6">
                                            <p className="text-sm text-warning/90 font-medium">Your account is currently vulnerable. It is highly recommended to enable Two-Factor Authentication immediately.</p>

                                            {!qrCodeSvg ? (
                                                <button
                                                    onClick={handleStart2FAEnrollment}
                                                    disabled={isEnrolling2FA}
                                                    className="px-6 py-2.5 bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/20 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                                                >
                                                    {isEnrolling2FA && <Loader2 className="w-4 h-4 animate-spin" />}
                                                    Enable 2FA (Authenticator App)
                                                </button>
                                            ) : (
                                                <div className="bg-background border border-border p-6 rounded-xl animate-in fade-in zoom-in-95 shadow-sm">
                                                    <h3 className="text-sm font-bold text-foreground mb-4">Step 1: Scan this code with Google Authenticator</h3>
                                                    <div className="bg-white p-4 rounded-xl w-fit mb-6 shadow-sm" dangerouslySetInnerHTML={{ __html: qrCodeSvg }} />

                                                    <h3 className="text-sm font-bold text-foreground mb-3">Step 2: Enter the 6-digit code to verify</h3>
                                                    <div className="flex gap-4">
                                                        <input
                                                            type="text"
                                                            maxLength={6}
                                                            value={verifyCode}
                                                            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                                                            placeholder="000000"
                                                            className="w-40 bg-card border border-border rounded-lg px-4 py-2.5 text-foreground font-mono text-center tracking-[0.2em] focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 outline-none shadow-sm transition-all"
                                                        />
                                                        <button
                                                            onClick={handleVerify2FAEnrollment}
                                                            disabled={verifyCode.length !== 6 || isVerifying2FA}
                                                            className="px-6 py-2.5 bg-[#10b981] text-white hover:bg-[#10b981]/90 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
                                                        >
                                                            {isVerifying2FA ? "Verifying..." : "Verify & Enable"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Global Authentication Policies */}
                            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-colors">
                                <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-foreground">Global Authentication Policies</h2>
                                        <p className="text-xs text-muted-foreground mt-1">Enforce security standards across all tenant accounts.</p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground">Force 2FA for Pharmacy Owners</h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">Requires an authenticator app for all Owner-level logins.</p>
                                        </div>
                                        <Toggle isOn={settings.require2FA} onToggle={() => handleChange("require2FA", !settings.require2FA)} />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border">
                                        <div className="space-y-2">
                                            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Session Timeout (Hours)</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={settings.sessionTimeoutHours}
                                                onChange={(e) => handleChange("sessionTimeoutHours", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                                                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 outline-none font-mono transition-all shadow-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Max Failed Logins (Lockout)</label>
                                            <input type="number" value={settings.maxLoginAttempts} onChange={(e) => handleChange("maxLoginAttempts", parseInt(e.target.value))} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 outline-none font-mono transition-all shadow-sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- API GATEWAYS --- */}
                    {activeTab === "gateways" && (
                        <div className="animate-in fade-in space-y-6">
                            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-colors">
                                <div className="p-6 border-b border-border bg-muted/20 flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-blue-500" />
                                    <div>
                                        <h2 className="text-lg font-bold text-foreground">SMTP Email Gateway</h2>
                                        <p className="text-xs text-muted-foreground mt-1">Configuration for sending OTPs and systemic alerts.</p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">SMTP Host</label>
                                            <input type="text" value={settings.smtpHost} onChange={(e) => handleChange("smtpHost", e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 outline-none font-mono transition-all shadow-sm" placeholder="smtp.gmail.com" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">SMTP User</label>
                                            <input type="text" value={settings.smtpUser} onChange={(e) => handleChange("smtpUser", e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 outline-none font-mono transition-all shadow-sm" placeholder="alerts@stockeasy.in" />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">SMTP Password / API Key</label>
                                            <input type="password" value={settings.smtpPass} onChange={(e) => handleChange("smtpPass", e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 outline-none font-mono transition-all shadow-sm" placeholder="••••••••••••••••" />
                                        </div>
                                    </div>

                                    {/* Test Connection Zone */}
                                    <div className="mt-8 pt-6 border-t border-border">
                                        <h3 className="text-sm font-bold text-foreground mb-4">Test Connection</h3>
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <input
                                                type="email"
                                                placeholder="Admin email to receive test..."
                                                value={testRecipient}
                                                onChange={(e) => setTestRecipient(e.target.value)}
                                                className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 outline-none font-mono transition-all shadow-sm"
                                            />
                                            <button
                                                onClick={handleTestSMTP}
                                                disabled={isTestingSMTP || !testRecipient}
                                                className="px-6 py-2.5 bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/20 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shrink-0 shadow-sm"
                                            >
                                                {isTestingSMTP ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                {isTestingSMTP ? "Testing..." : "Send Test Email"}
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- SYSTEM & LOGS --- */}
                    {activeTab === "system" && (
                        <div className="animate-in fade-in space-y-6">
                            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-colors">
                                <div className="p-6 border-b border-border bg-muted/20">
                                    <h2 className="text-lg font-bold text-foreground">Database Operations</h2>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground">Automated Nightly Backups</h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">Dump production PostgreSQL to secure storage at 00:00 UTC.</p>
                                        </div>
                                        <Toggle isOn={settings.autoBackup} onToggle={() => handleChange("autoBackup", !settings.autoBackup)} />
                                    </div>

                                    <div className="flex items-center justify-between pt-6 border-t border-border">
                                        <div>
                                            <h3 className="text-sm font-bold text-foreground">Log Retention Policy</h3>
                                            <p className="text-xs text-muted-foreground mt-0.5">Number of days to keep API and audit logs before purging.</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="number" value={settings.logRetentionDays} onChange={(e) => handleChange("logRetentionDays", parseInt(e.target.value))} className="w-20 bg-background border border-border rounded-lg px-3 py-1.5 text-foreground text-sm focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 outline-none font-mono text-center transition-all shadow-sm" />
                                            <span className="text-xs text-muted-foreground font-medium">Days</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* DANGER ZONE - NOW FULLY INTERACTIVE */}
                            <div className="border border-destructive/50 bg-destructive/5 rounded-2xl overflow-hidden relative mt-8 transition-colors">
                                <div className="absolute top-0 left-0 w-1 h-full bg-destructive"></div>
                                <div className="p-6">
                                    <h2 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-destructive" /> Danger Zone
                                    </h2>
                                    <p className="text-sm text-muted-foreground mb-6">These actions are irreversible and affect the entire platform environment.</p>

                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between p-4 bg-background border border-destructive/20 rounded-xl shadow-sm">
                                            <div>
                                                <h4 className="text-sm font-bold text-foreground">Purge System Cache</h4>
                                                <p className="text-xs text-muted-foreground mt-0.5">Forces all edges to revalidate. May cause a temporary spike in database load.</p>
                                            </div>
                                            <button
                                                onClick={handleClearCache}
                                                disabled={isClearingCache}
                                                className="px-4 py-2 bg-muted border border-border rounded-lg text-sm text-foreground hover:bg-muted/80 font-bold transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
                                            >
                                                {isClearingCache && <Loader2 className="w-4 h-4 animate-spin" />}
                                                {isClearingCache ? "Purging..." : "Clear Cache"}
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-destructive/10 border border-destructive/30 rounded-xl shadow-sm">
                                            <div>
                                                <h4 className="text-sm font-bold text-destructive">Trigger Manual Database Backup</h4>
                                                <p className="text-xs text-destructive/80 mt-0.5">Instantly snapshot the database. Bypasses the nightly schedule.</p>
                                            </div>
                                            <button
                                                onClick={handleManualBackup}
                                                disabled={isBackingUp}
                                                className="px-4 py-2 bg-destructive/20 border border-destructive/50 rounded-lg text-sm text-destructive hover:bg-destructive/30 font-bold transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
                                            >
                                                {isBackingUp && <Loader2 className="w-4 h-4 animate-spin" />}
                                                {isBackingUp ? "Snapshotting..." : "Snapshot Now"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}