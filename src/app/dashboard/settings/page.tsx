"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import {
    User, Camera, Save, Loader2, Info, Trash2, Plus, X,
    ShieldAlert, Edit, CheckCircle2, Lock, ShieldCheck,
    Ban, CreditCard, Smartphone, AlertTriangle, ChevronDown
} from "lucide-react";

import {
    Eye,
    EyeOff
} from "lucide-react";

type TabType = "profile" | "staff" | "password" | "subscription";

interface StaffMember {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
}

// Custom UI Component for the Filter Dropdown
const FilterDropdown = ({
    value,
    options,
    onChange,
    icon: Icon,
    className,
    disabled
}: {
    value: string,
    options: { value: string, label: string }[],
    onChange: (val: string) => void,
    icon?: any,
    className?: string,
    disabled?: boolean
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedLabel = options.find((o) => o.value === value)?.label || value || "Select an option";

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={className || `w-full bg-card border border-border rounded-xl flex items-center justify-between px-4 py-2.5 shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <div className="flex items-center gap-2 pr-4 truncate">
                    {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className={`text-sm truncate ${!value && options[0]?.value === "" ? "text-muted-foreground" : "text-foreground"}`}>
                        {selectedLabel}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && !disabled && (
                <div className="absolute top-full left-0 mt-1.5 w-full bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="py-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-muted ${value === opt.value
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-foreground'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function SettingsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>("profile");
    const [isLoading, setIsLoading] = useState(true);
    const [shopId, setShopId] = useState<string | null>(null);

    // Access Control States
    const [userRole, setUserRole] = useState<string>("OWNER");
    const [userEmail, setUserEmail] = useState<string>("");
    const [ownerName, setOwnerName] = useState<string>("");

    // Profile State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");

    const defaultProfile = {
        name: "", contact_number: "", alternate_contact_no: "", email_address: "", address: "", logo_url: "",
        drug_license_no: "", license_expiry: "", pan_number: "", gst_number: "", business_type: "", plan: "STARTER"
    };

    const [originalProfileData, setOriginalProfileData] = useState(defaultProfile);
    const [profileData, setProfileData] = useState(defaultProfile);

    const isDirty = JSON.stringify(originalProfileData) !== JSON.stringify(profileData);

    // Staff State
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [isStaffSaving, setIsStaffSaving] = useState(false);
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
    const [staffFormData, setStaffFormData] = useState({ name: "", email: "", role: "STAFF", status: "ACTIVE" });

    // Password State
    const [passwordData, setPasswordData] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });

    const [showPassword, setShowPassword] = useState({
        current: false,
        new: false,
        confirm: false,
    });

    // 🚨 NEW: MFA States for Password Update
    const [mfaChallengeData, setMfaChallengeData] = useState<{ factorId: string, challengeId: string } | null>(null);
    const [mfaCode, setMfaCode] = useState("");

    // Simulator State
    const [simulatorOpen, setSimulatorOpen] = useState(false);
    const [simOptions, setSimOptions] = useState<any>(null);
    const [isProcessingSim, setIsProcessingSim] = useState(false);

    // Account Deletion States
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [deleteErrorMsg, setDeleteErrorMsg] = useState("");

    useEffect(() => {
        fetchInitialData();

        const handleOpenSim = (e: Event) => {
            setSimOptions((e as CustomEvent).detail);
            setSimulatorOpen(true);
        };
        window.addEventListener("open-razorpay-simulation", handleOpenSim);
        return () => window.removeEventListener("open-razorpay-simulation", handleOpenSim);
    }, []);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUserEmail(user.email || "");

            const { data: userData } = await supabase.from('users').select('shop_id, role, full_name').eq('id', user.id).single();
            if (!userData?.shop_id) return;

            setShopId(userData.shop_id);
            setOwnerName(userData.full_name || "");

            const currentRole = userData.role || "OWNER";
            setUserRole(currentRole);

            if (currentRole === "STAFF") {
                setIsLoading(false);
                return;
            }

            const { data: shopData } = await supabase.from('shops').select('*').eq('id', userData.shop_id).single();
            if (shopData) {
                const fetchedData = {
                    name: shopData.name || "",
                    contact_number: shopData.contact_number || "",
                    alternate_contact_no: shopData.alternate_contact_no || "",
                    email_address: shopData.email_address || "",
                    address: shopData.address || "",
                    logo_url: shopData.logo_url || "",
                    drug_license_no: shopData.license_number || "",
                    license_expiry: shopData.license_expiry || "",
                    pan_number: shopData.pan_number || "",
                    gst_number: shopData.gst_number || shopData.gstin || "",
                    business_type: shopData.business_type || "",
                    plan: shopData.plan || "STARTER"
                };
                setOriginalProfileData(fetchedData);
                setProfileData(fetchedData);
            }

            const { data: staffData } = await supabase.from('staff_profiles').select('*').eq('shop_id', userData.shop_id).order('created_at', { ascending: true });
            const strictlyStaff = (staffData || []).filter((member: any) => member.role !== 'OWNER');
            setStaff(strictlyStaff);

        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const executeSimulatedPayment = async () => {
        if (!simOptions) return;
        setIsProcessingSim(true);
        await new Promise((resolve) => setTimeout(resolve, 1800));

        const mockResponse = {
            razorpay_order_id: simOptions.order_id,
            razorpay_payment_id: `pay_${Math.random().toString(36).substring(2, 11)}`,
            razorpay_signature: "mock_signature_approved",
        };

        setSimulatorOpen(false);
        setIsProcessingSim(false);

        if (simOptions.handler) {
            simOptions.handler(mockResponse);
        }
    };

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setIsUploading(true);
            const file = event.target.files?.[0];
            if (!file || !shopId) return;

            const fileExt = file.name.split('.').pop();
            const filePath = `${shopId}/${Date.now()}-logo.${fileExt}`;
            await supabase.storage.from('shop_logos').upload(filePath, file, { upsert: true });
            const { data: { publicUrl } } = supabase.storage.from('shop_logos').getPublicUrl(filePath);
            await supabase.from('shops').update({ logo_url: publicUrl }).eq('id', shopId);

            const updatedData = { ...profileData, logo_url: publicUrl };
            setProfileData(updatedData);
            setOriginalProfileData(updatedData);
        } catch (error) {
            alert("Upload failed.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveLogo = async () => {
        if (!shopId || !profileData.logo_url || !window.confirm("Remove shop logo?")) return;
        setIsUploading(true);
        try {
            const urlParts = profileData.logo_url.split('/shop_logos/');
            if (urlParts.length === 2) await supabase.storage.from('shop_logos').remove([urlParts[1]]);
            await supabase.from('shops').update({ logo_url: null }).eq('id', shopId);
            const updatedData = { ...profileData, logo_url: "" };
            setProfileData(updatedData);
            setOriginalProfileData(updatedData);
        } catch (error) {
            console.error(error);
        } finally {
            setIsUploading(false);
        }
    };

    const handlePhoneChange = (value: string, field: "contact_number" | "alternate_contact_no") => {
        const numbersOnly = value.replace(/\D/g, "");
        if (numbersOnly.length <= 10) {
            setProfileData(prev => ({ ...prev, [field]: numbersOnly }));
        }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shopId || !isDirty) return;

        if (profileData.contact_number.length !== 10) {
            alert("Shop's Primary contact number must be exactly 10 digits.");
            return;
        }

        setIsSaving(true);
        setSuccessMsg("");

        try {
            const payload = {
                name: profileData.name,
                contact_number: profileData.contact_number,
                alternate_contact_no: profileData.alternate_contact_no || null,
                email_address: profileData.email_address,
                address: profileData.address
            };

            const { data: updatedShop, error } = await supabase
                .from('shops')
                .update(payload)
                .eq('id', shopId)
                .select()
                .single();

            if (error) throw error;

            const confirmedData = { ...profileData, ...updatedShop };
            setProfileData(confirmedData);
            setOriginalProfileData(confirmedData);

            setSuccessMsg("Profile synced securely.");
            setTimeout(() => setSuccessMsg(""), 4000);
        } catch (error: any) {
            alert(`Failed to sync profile: ${error.message || "Unknown error"}`);
        } finally {
            setIsSaving(false);
        }
    };

    const openStaffModal = (member?: StaffMember) => {
        const currentPlan = profileData.plan || "STARTER";

        if (!member) {
            if (currentPlan === "STARTER") {
                alert("The Free Starter plan does not support staff accounts. Please upgrade to the Growth plan to add staff.");
                setActiveTab("subscription");
                return;
            }
            if (currentPlan === "GROWTH" && staff.length >= 5) {
                alert("The Growth plan allows a maximum of 5 staff accounts. Please upgrade to Pro for unlimited staff.");
                setActiveTab("subscription");
                return;
            }
        }

        if (member) {
            setEditingStaffId(member.id);
            setStaffFormData({ name: member.name, email: member.email, role: member.role, status: member.status });
        } else {
            setEditingStaffId(null);
            setStaffFormData({ name: "", email: "", role: "STAFF", status: "ACTIVE" });
        }
        setIsStaffModalOpen(true);
    };

    const handleSaveStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shopId) return;
        setIsStaffSaving(true);

        try {
            if (editingStaffId) {
                await supabase.from('staff_profiles').update(staffFormData).eq('id', editingStaffId);
            } else {
                const { data: { user } } = await supabase.auth.getUser();

                const res = await fetch('/api/staff/invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: staffFormData.email,
                        name: staffFormData.name,
                        role: staffFormData.role,
                        shopId: shopId,
                        inviterId: user?.id
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to invite staff.");

                alert("An invitation email has been securely sent to the staff member!");
            }

            const { data } = await supabase.from('staff_profiles').select('*').eq('shop_id', shopId).order('created_at', { ascending: true });
            const strictlyStaff = (data || []).filter((member: any) => member.role !== 'OWNER');
            setStaff(strictlyStaff);

            setIsStaffModalOpen(false);
        } catch (error: any) {
            alert(error.message || "Failed to process staff record.");
        } finally {
            setIsStaffSaving(false);
        }
    };

    const handleDeleteStaff = async (id: string, name: string) => {
        if (!window.confirm(`Revoke completely all system permissions for ${name}? This will log them out instantly.`)) return;

        try {
            const res = await fetch('/api/staff/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staffAuthId: id,
                    staffProfileId: id
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to remove staff");

            setStaff(prev => prev.filter(s => s.id !== id));

        } catch (error: any) {
            console.error(error);
            alert(`Error removing staff: ${error.message}`);
        }
    };

    // 🚨 UPDATED: Smart MFA Detection
    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMsg({ type: "", text: "" });

        if (!passwordData.oldPassword) return setPasswordMsg({ type: "error", text: "Current password is required." });
        if (passwordData.newPassword !== passwordData.confirmPassword) return setPasswordMsg({ type: "error", text: "New passwords do not match." });
        if (passwordData.newPassword.length < 8) return setPasswordMsg({ type: "error", text: "New password must be at least 8 characters long." });

        setIsUpdatingPassword(true);
        try {
            // 1. Verify current password
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: userEmail,
                password: passwordData.oldPassword
            });

            if (signInError) throw new Error("Incorrect current password.");

            // 2. Ask Supabase if this specific user has an Authenticator App linked
            const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (aalError) throw aalError;

            // 3. If they HAVE an app linked (nextLevel === aal2) but haven't verified it this session
            if (aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
                const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
                if (factorsError) throw factorsError;

                const totpFactor = factors.totp[0];
                if (!totpFactor) throw new Error("MFA is enrolled but no TOTP factor was found.");

                const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
                if (challengeError) throw challengeError;

                // Trigger the UI to ask for the code
                setMfaChallengeData({ factorId: totpFactor.id, challengeId: challenge.id });
                setPasswordMsg({ type: "warning", text: "Authenticator App code required to proceed." });
                setIsUpdatingPassword(false);
                return; // Stop here and wait for the user to enter the code
            }

            // 4. If they DO NOT have an app linked, skip straight to updating the password!
            await commitPasswordUpdate();

        } catch (error: any) {
            setPasswordMsg({ type: "error", text: error.message || "Failed to update password." });
            setIsUpdatingPassword(false);
        }
    };

    // 🚨 NEW: Handles verifying the 6-digit MFA code
    const handleVerifyMfaAndUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mfaChallengeData || mfaCode.length !== 6) {
            setPasswordMsg({ type: "error", text: "Please enter a valid 6-digit code." });
            return;
        }

        setIsUpdatingPassword(true);
        try {
            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId: mfaChallengeData.factorId,
                challengeId: mfaChallengeData.challengeId,
                code: mfaCode
            });

            if (verifyError) throw new Error("Invalid authenticator code.");

            // Session is now AAL2! Proceed to update password.
            await commitPasswordUpdate();

        } catch (error: any) {
            setPasswordMsg({ type: "error", text: error.message || "MFA verification failed." });
            setIsUpdatingPassword(false);
        }
    };

    // 🚨 NEW: The actual password commit logic extracted for reuse
    const commitPasswordUpdate = async () => {
        const { error: updateError } = await supabase.auth.updateUser({ password: passwordData.newPassword });
        if (updateError) throw updateError;

        setPasswordMsg({ type: "success", text: "Password updated successfully!" });
        setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
        setMfaChallengeData(null);
        setMfaCode("");
        setIsUpdatingPassword(false);
        setTimeout(() => setPasswordMsg({ type: "", text: "" }), 4000);
    };


    const handlePlanUpdate = async (newPlan: string) => {
        if (!shopId) return;

        const currentPlan = profileData.plan || "STARTER";
        if (newPlan === currentPlan) return;

        const confirmChange = window.confirm(`Proceed to checkout for the ${newPlan} plan?`);
        if (!confirmChange) return;

        const prices: Record<string, number> = {
            "STARTER": 0,
            "GROWTH": 599,
            "PRO": 1499
        };
        const amount = prices[newPlan.toUpperCase()] || 0;

        setIsSaving(true);
        try {
            const res = await fetch("/api/razorpay/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan: newPlan, amount: amount }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to initiate order");

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_mock",
                amount: data.amount,
                currency: "INR",
                name: "StockEasy Technologies",
                description: `${newPlan} Subscription Plan`,
                order_id: data.orderId,
                handler: async function (response: any) {
                    try {
                        const verifyRes = await fetch("/api/razorpay/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                shop_id: shopId,
                                new_plan: newPlan,
                            }),
                        });

                        const verifyData = await verifyRes.json();
                        if (verifyRes.ok && verifyData.success) {
                            setProfileData(prev => ({ ...prev, plan: newPlan }));
                            setOriginalProfileData(prev => ({ ...prev, plan: newPlan }));
                            alert(`Successfully upgraded to the ${newPlan} plan!`);
                        } else {
                            alert(verifyData.error || "Payment verification failed.");
                        }
                    } catch (err) {
                        alert("An error occurred while confirming your payment.");
                    }
                },
                prefill: {
                    name: profileData.name || "Pharmacy Owner",
                    email: profileData.email_address || userEmail,
                },
                theme: { color: "#6ee591" },
            };

            const event = new CustomEvent("open-razorpay-simulation", { detail: options });
            window.dispatchEvent(event);

        } catch (error) {
            console.error("Billing error:", error);
            alert("Billing system error. Check your API keys and try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelSubscription = async () => {
        const confirm = window.confirm("Are you sure you want to cancel your active subscription? You will lose access to premium features and be reverted to the Free Starter plan.");
        if (!confirm || !shopId) return;

        setIsSaving(true);
        try {
            const { error } = await supabase.from('shops').update({ plan: 'STARTER' }).eq('id', shopId);
            if (error) throw error;

            setProfileData(prev => ({ ...prev, plan: 'STARTER' }));
            setOriginalProfileData(prev => ({ ...prev, plan: 'STARTER' }));
            alert("Subscription cancelled successfully. You are now on the Free Starter plan.");
        } catch (err) {
            alert("Failed to cancel subscription. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!shopId || !userEmail || !deletePassword) return;

        setIsDeletingAccount(true);
        setDeleteErrorMsg("");

        try {
            const res = await fetch('/api/owner/account/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopId,
                    email: userEmail,
                    password: deletePassword
                })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to initiate deletion.");

            await supabase.auth.signOut();
            alert("Account has been scheduled for deletion. You will now be logged out.");
            router.push('/login');

        } catch (error: any) {
            setDeleteErrorMsg(error.message);
        } finally {
            setIsDeletingAccount(false);
        }
    };

    const TabButton = ({ id, label }: { id: TabType, label: string }) => (
        <button
            type="button"
            onClick={() => setActiveTab(id)}
            className={`pb-3 px-2 sm:px-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
        >
            {label}
        </button>
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p>Loading configurations...</p>
            </div>
        );
    }

    if (userRole === "STAFF") {
        return (
            <div className="max-w-2xl mx-auto mt-10 sm:mt-20 animate-in fade-in duration-500 p-4">
                <div className="bg-card border border-destructive/30 rounded-2xl shadow-xl p-6 sm:p-10 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-destructive to-transparent opacity-50"></div>
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6 border border-destructive/20">
                        <Ban className="w-8 h-8 sm:w-10 sm:h-10 text-destructive" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Access Restricted</h1>
                    <p className="text-muted-foreground mb-6 max-w-md leading-relaxed text-sm sm:text-base">
                        Your account is provisioned with <strong>Staff</strong> privileges. Administrative configurations, shop profile edits, and subscription details are strictly restricted to the Shop Owner.
                    </p>
                    <div className="w-full sm:w-auto px-4 sm:px-6 py-3 bg-secondary border border-border rounded-xl text-xs sm:text-sm font-mono text-muted-foreground truncate">
                        Logged in as: <span className="text-foreground font-bold">{userEmail}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in duration-500 space-y-6 sm:space-y-8 relative pb-20">

            {/* SIMULATOR MODAL */}
            {simulatorOpen && simOptions && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-card border w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col border-emerald-500/30">

                        <div className="bg-card p-4 sm:p-5 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] sm:text-xs font-mono tracking-wider uppercase text-emerald-500 font-medium">
                                    Razorpay Sandbox Intercept
                                </span>
                            </div>
                            <button onClick={() => setSimulatorOpen(false)} className="text-muted-foreground hover:text-foreground text-sm cursor-pointer p-1">Cancel</button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-6 flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-semibold text-foreground text-base sm:text-lg">{simOptions.name}</h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">{simOptions.description}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl sm:text-2xl font-bold text-foreground">₹{simOptions.amount / 100}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">Test Transaction</p>
                                </div>
                            </div>

                            <div className="bg-secondary rounded-lg p-4 border border-border space-y-3">
                                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Simulated Checkout Path</p>
                                <div className="flex items-center gap-3 text-xs sm:text-sm text-foreground">
                                    <CreditCard className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span>Cards, UPI, Netbanking Interfaces Active</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs sm:text-sm text-foreground">
                                    <Smartphone className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span>Pre-authenticated Sandbox Authorization Profile</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground justify-center">
                                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span>Secured End-to-End Pipeline</span>
                            </div>
                        </div>

                        <div className="p-4 bg-muted/50 border-t border-border">
                            <button
                                onClick={executeSimulatedPayment}
                                disabled={isProcessingSim}
                                className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-sm sm:text-base"
                            >
                                {isProcessingSim ? (
                                    <><Loader2 className="w-4 h-4 animate-spin text-white" /> Authorizing...</>
                                ) : (
                                    `Authorize Payment of ₹${simOptions.amount / 100}`
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STAFF MODAL */}
            {isStaffModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-border bg-muted/30 shrink-0">
                            <h3 className="font-bold text-foreground text-base sm:text-lg">{editingStaffId ? 'Modify Staff Credentials' : 'Provision Staff Access'}</h3>
                            <button type="button" onClick={() => setIsStaffModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSaveStaff} className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="space-y-1.5"><label className="text-xs font-mono text-muted-foreground">Full Name *</label><input type="text" required value={staffFormData.name} onChange={e => setStaffFormData({ ...staffFormData, name: e.target.value })} className="w-full px-4 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary" /></div>
                            <div className="space-y-1.5"><label className="text-xs font-mono text-muted-foreground">Business Email *</label><input type="email" required disabled={!!editingStaffId} value={staffFormData.email} onChange={e => setStaffFormData({ ...staffFormData, email: e.target.value })} className="w-full px-4 py-2.5 bg-secondary border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50" /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5 relative z-20">
                                    <label className="text-xs font-mono text-muted-foreground">System Role</label>
                                    <FilterDropdown
                                        value={staffFormData.role}
                                        onChange={(val) => setStaffFormData({ ...staffFormData, role: val })}
                                        options={[{ value: "STAFF", label: "STAFF" }]}
                                        disabled={!!editingStaffId}
                                        className={`w-full px-4 py-2.5 bg-secondary border border-border rounded-xl flex items-center justify-between text-sm text-foreground focus:outline-none focus:border-primary appearance-none ${!!editingStaffId ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary transition-colors cursor-pointer'}`}
                                    />
                                </div>
                                <div className="space-y-1.5 relative z-10">
                                    <label className="text-xs font-mono text-muted-foreground">Access Status</label>
                                    <FilterDropdown
                                        value={staffFormData.status}
                                        onChange={(val) => setStaffFormData({ ...staffFormData, status: val })}
                                        options={[
                                            { value: "ACTIVE", label: "ACTIVE" },
                                            { value: "SUSPENDED", label: "SUSPENDED" }
                                        ]}
                                        className="w-full px-4 py-2.5 bg-secondary border border-border rounded-xl flex items-center justify-between text-sm text-foreground focus:outline-none focus:border-primary hover:border-primary transition-colors cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3">
                                <button type="button" onClick={() => setIsStaffModalOpen(false)} className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-lg font-bold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors cursor-pointer">Cancel</button>
                                <button type="submit" disabled={isStaffSaving} className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-lg font-bold text-primary-foreground bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">{isStaffSaving && <Loader2 className="w-4 h-4 animate-spin" />} Sync Profile</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Verification Modal for Account Deletion */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-card border border-destructive/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-destructive/10 rounded-full flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-bold text-foreground">Confirm Deletion</h2>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Enter your password to verify</p>
                                </div>
                            </div>
                            <button onClick={() => setIsDeleteModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
                            {deleteErrorMsg && (
                                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive font-medium">
                                    {deleteErrorMsg}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Account Password</label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="password"
                                        value={deletePassword}
                                        onChange={(e) => setDeletePassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-xl text-foreground text-sm focus:border-destructive outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-muted/50 border-t border-border flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={isDeletingAccount}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={!deletePassword || isDeletingAccount}
                                className="w-full sm:w-auto px-6 py-2.5 bg-destructive text-white rounded-lg text-sm font-bold hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isDeletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                {isDeletingAccount ? "Verifying..." : "Confirm & Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PAGE HEADER */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-1 sm:mb-2">Settings & Profile</h1>
                <p className="text-muted-foreground text-sm">Manage your pharmacy identity, staff, password, and subscription.</p>
            </div>

            {/* FIX: Swipeable horizontal tabs on mobile */}
            <div className="flex items-center gap-4 sm:gap-8 border-b border-border overflow-x-auto custom-scrollbar pb-1">
                <TabButton id="profile" label="Shop Profile" />
                <TabButton id="staff" label="Staff" />
                <TabButton id="password" label="Password" />
                <TabButton id="subscription" label="Subscription" />
            </div>

            {/* TAB: PROFILE */}
            {activeTab === "profile" && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="bg-card border border-border rounded-2xl shadow-sm p-5 sm:p-8 space-y-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 sm:p-4 bg-primary/5 rounded-bl-3xl border-b border-l border-primary/20">
                            <div className="flex items-center gap-1 sm:gap-2 text-primary font-bold text-[10px] sm:text-xs"><ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4" /> VERIFIED</div>
                        </div>
                        <div className="pr-20 sm:pr-0">
                            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2"><Lock className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" /> Legal & Compliance Details</h2>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">These details were verified during registration. Contact Support to request an amendment.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 opacity-80 mt-4">
                            <div className="space-y-1.5"><label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Owner Name</label><div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-secondary border border-border rounded-xl text-sm text-muted-foreground font-mono cursor-not-allowed truncate">{ownerName || "N/A"}</div></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Business Type</label><div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-secondary border border-border rounded-xl text-sm text-muted-foreground font-mono cursor-not-allowed truncate">{profileData.business_type || "N/A"}</div></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">PAN Number</label><div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-secondary border border-border rounded-xl text-sm text-muted-foreground font-mono cursor-not-allowed uppercase truncate">{profileData.pan_number || "N/A"}</div></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">GST Number</label><div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-secondary border border-border rounded-xl text-sm text-muted-foreground font-mono cursor-not-allowed uppercase truncate">{profileData.gst_number || "N/A"}</div></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Drug License No.</label><div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-secondary border border-border rounded-xl text-sm text-muted-foreground font-mono cursor-not-allowed uppercase truncate">{profileData.drug_license_no || "N/A"}</div></div>
                            <div className="space-y-1.5"><label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">License Expiry Date</label><div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-secondary border border-border rounded-xl text-sm text-muted-foreground font-mono cursor-not-allowed truncate">{profileData.license_expiry || "N/A"}</div></div>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-2xl shadow-sm p-5 sm:p-8 space-y-6 sm:space-y-8">
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg, image/png" onChange={handleLogoUpload} />

                        {/* FIX: Stack logo upload on mobile */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 pb-6 border-b border-border">
                            <div className="relative shrink-0">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden">
                                    {isUploading ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-primary" /> : profileData.logo_url ? <img src={profileData.logo_url} alt="Logo" className="w-full h-full object-cover" /> : <User className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />}
                                </div>
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full border-2 border-card cursor-pointer"><Camera className="w-3 h-3" /></button>
                            </div>
                            <div className="w-full sm:w-auto">
                                <h3 className="text-foreground font-bold text-base">Shop Logo</h3>
                                <div className="flex gap-2 mt-2 w-full sm:w-auto">
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none px-3 py-1.5 bg-muted border border-border text-foreground text-xs font-bold rounded-lg hover:bg-muted/80 cursor-pointer">Upload New</button>
                                    {profileData.logo_url && <button type="button" onClick={handleRemoveLogo} className="flex-1 sm:flex-none px-3 py-1.5 text-destructive/80 text-xs font-bold hover:text-destructive cursor-pointer">Remove</button>}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSaveProfile} className="space-y-4 sm:space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Shop Name *</label>
                                <input type="text" required value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-secondary border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Primary Contact Number *</label>
                                    <input type="text" inputMode="numeric" pattern="[0-9]{10}" required value={profileData.contact_number} onChange={e => handlePhoneChange(e.target.value, "contact_number")} className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-secondary border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors font-mono" placeholder="10-digit mobile number" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Alternate Contact Number</label>
                                    <input type="text" inputMode="numeric" pattern="[0-9]{10}" value={profileData.alternate_contact_no || ""} onChange={e => handlePhoneChange(e.target.value, "alternate_contact_no")} className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-secondary border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors font-mono" placeholder="Optional 10-digit number" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Business Email Address</label>
                                    <input type="email" value={profileData.email_address} onChange={e => setProfileData({ ...profileData, email_address: e.target.value })} className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-secondary border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Full Shop Address</label>
                                    <textarea rows={3} value={profileData.address} onChange={e => setProfileData({ ...profileData, address: e.target.value })} className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-secondary border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none" />
                                </div>
                            </div>

                            {/* FIX: Stack buttons on mobile */}
                            <div className="pt-4 flex flex-col-reverse sm:flex-row items-center justify-between border-t border-border mt-6 gap-4">
                                <div className="w-full sm:w-auto text-center sm:text-left">
                                    {successMsg && <span className="text-sm font-bold text-primary animate-in fade-in block">{successMsg}</span>}
                                    {!isDirty && !successMsg && <span className="text-sm text-muted-foreground italic block">All editable changes are synced.</span>}
                                    {isDirty && !isSaving && <span className="text-sm font-bold text-warning animate-in fade-in block">You have unsaved changes!</span>}
                                </div>
                                <button type="submit" disabled={isSaving || !isDirty} className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${isDirty ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer' : 'bg-secondary text-muted-foreground border border-border cursor-not-allowed'}`}>
                                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />} {isDirty ? "Save Changes" : "Saved"}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* --- DANGER ZONE --- */}
                    <div className="border border-destructive/50 bg-destructive/5 rounded-2xl overflow-hidden relative mt-8">
                        <div className="absolute top-0 left-0 w-1 h-full bg-destructive"></div>
                        <div className="p-5 sm:p-6">
                            <h2 className="text-base sm:text-lg font-bold text-foreground mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-destructive" /> Danger Zone
                            </h2>
                            <p className="text-xs sm:text-sm text-muted-foreground mb-6">
                                Permanently deleting your account will schedule your shop, inventory, and staff data for complete incineration after a 30-day grace period.
                            </p>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-destructive/10 border border-destructive/30 rounded-xl gap-4">
                                <div>
                                    <h4 className="text-sm font-bold text-destructive">Delete Pharmacy Account</h4>
                                    <p className="text-[10px] sm:text-xs text-destructive/80 mt-0.5">This action cannot be undone once the grace period expires.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsDeleteModalOpen(true)}
                                    className="w-full sm:w-auto justify-center px-5 py-2.5 bg-destructive text-white rounded-lg text-sm font-bold hover:bg-destructive/90 transition-colors flex items-center gap-2 cursor-pointer shrink-0"
                                >
                                    <Trash2 className="w-4 h-4 shrink-0" /> Delete Account
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: STAFF */}
            {activeTab === "staff" && (
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col animate-in fade-in">
                    <div className="p-4 sm:p-6 border-b border-border bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
                        <div>
                            <h2 className="font-bold text-foreground text-base sm:text-lg">Staff Members</h2>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Provision permissions and roles for your healthcare staff.</p>
                        </div>
                        <button type="button" onClick={() => openStaffModal()} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 sm:py-2 rounded-xl font-bold hover:bg-primary/90 transition-all cursor-pointer">
                            <Plus className="w-4 h-4" /> Add Staff
                        </button>
                    </div>
                    {/* FIX: Horizontal wrapper for staff table */}
                    <div className="overflow-x-auto custom-scrollbar flex-1">
                        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
                            <thead>
                                <tr className="text-[10px] sm:text-xs tracking-wider text-muted-foreground font-mono border-b border-border bg-muted/20">
                                    <th className="px-4 sm:px-6 py-4 font-bold uppercase">Name</th>
                                    <th className="px-4 sm:px-6 py-4 font-bold uppercase">Email</th>
                                    <th className="px-4 sm:px-6 py-4 font-bold uppercase">Role</th>
                                    <th className="px-4 sm:px-6 py-4 font-bold uppercase">Status</th>
                                    <th className="px-4 sm:px-6 py-4 font-bold uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {staff.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-16 text-center text-muted-foreground text-sm">No secondary staff profiles registered. Add system handles above.</td></tr>
                                ) : (
                                    staff.map((member) => (
                                        <tr key={member.id} className="hover:bg-muted/50 transition-colors group">
                                            <td className="px-4 sm:px-6 py-4 font-bold text-foreground text-sm">{member.name}</td>
                                            <td className="px-4 sm:px-6 py-4 text-sm font-mono text-muted-foreground">{member.email}</td>
                                            <td className="px-4 sm:px-6 py-4"><span className={`px-2.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-bold tracking-wider ${member.role === 'OWNER' ? 'bg-primary/10 border border-primary/30 text-primary' : 'bg-muted border border-border text-muted-foreground'}`}>{member.role}</span></td>
                                            <td className="px-4 sm:px-6 py-4"><div className="flex items-center gap-1.5 text-xs sm:text-sm"><span className={`w-2 h-2 rounded-full shrink-0 ${member.status === 'ACTIVE' ? 'bg-primary' : 'bg-destructive'}`} /><span className={member.status === 'ACTIVE' ? 'text-foreground' : 'text-destructive/80'}>{member.status}</span></div></td>
                                            <td className="px-4 sm:px-6 py-4 text-right">
                                                <div className="flex justify-end gap-4 sm:gap-3 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                    <button type="button" onClick={() => openStaffModal(member)} className="text-muted-foreground hover:text-foreground transition-all cursor-pointer p-1"><Edit className="w-4 h-4" /></button>
                                                    <button type="button" onClick={() => handleDeleteStaff(member.id, member.name)} className="text-destructive/70 hover:text-destructive transition-all cursor-pointer p-1"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB: PASSWORD */}
            {activeTab === "password" && (
                <div className="bg-card border border-border rounded-2xl shadow-sm p-5 sm:p-8 max-w-xl animate-in fade-in space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-border">
                        <ShieldAlert className="w-5 h-5 text-primary shrink-0" />
                        <div>
                            <h3 className="font-bold text-foreground text-base sm:text-lg">Change System Password</h3>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Update your account password to maintain security.</p>
                        </div>
                    </div>

                    {/* 🚨 NEW: Show MFA challenge form if AAL1 needs to jump to AAL2 */}
                    {mfaChallengeData ? (
                        <form onSubmit={handleVerifyMfaAndUpdate} className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                            <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl mb-4">
                                <p className="text-sm font-bold text-primary mb-1">Action Requires Verification</p>
                                <p className="text-xs text-muted-foreground">Please open your authenticator app and enter the 6-digit code to authorize this password change.</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">6-Digit Code</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    required
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                    className="w-full bg-secondary border border-border focus:border-primary outline-none transition-colors rounded-xl px-4 py-3 text-foreground text-lg tracking-[0.5em] font-mono text-center shadow-sm"
                                    placeholder="••••••"
                                />
                            </div>

                            {passwordMsg.text && passwordMsg.type === 'error' && (
                                <div className="p-3 rounded-lg text-sm font-bold flex items-center gap-2 bg-destructive/10 text-destructive">
                                    <ShieldAlert className="w-4 h-4 shrink-0" /> {passwordMsg.text}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setMfaChallengeData(null)} className="w-full px-4 py-3 rounded-xl font-bold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors cursor-pointer text-sm">Cancel</button>
                                <button type="submit" disabled={isUpdatingPassword || mfaCode.length !== 6} className="w-full px-4 py-3 rounded-xl font-bold text-primary-foreground bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer text-sm">
                                    {isUpdatingPassword && <Loader2 className="w-4 h-4 animate-spin" />} Verify & Update
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleUpdatePassword} className="space-y-4 sm:space-y-5 animate-in fade-in duration-300">
                            <div className="space-y-1.5">
                                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Current Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword.current ? "text" : "password"}
                                        required
                                        value={passwordData.oldPassword}
                                        onChange={(e) =>
                                            setPasswordData({
                                                ...passwordData,
                                                oldPassword: e.target.value
                                            })
                                        }
                                        className="w-full bg-secondary border border-border focus:border-primary outline-none transition-colors rounded-xl px-4 py-2.5 pr-12 text-foreground text-sm shadow-sm"
                                    />

                                    <button
                                        type="button"
                                        aria-label={
                                            showPassword.current
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                        onClick={() =>
                                            setShowPassword(prev => ({
                                                ...prev,
                                                current: !prev.current
                                            }))
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                        {showPassword.current ? (
                                            <Eye className="w-5 h-5" />
                                        ) : (
                                            <EyeOff className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword.new ? "text" : "password"}
                                        required
                                        value={passwordData.newPassword}
                                        onChange={(e) =>
                                            setPasswordData({
                                                ...passwordData,
                                                newPassword: e.target.value
                                            })
                                        }
                                        className="w-full bg-secondary border border-border focus:border-primary outline-none transition-colors rounded-xl px-4 py-2.5 pr-12 text-foreground text-sm shadow-sm"
                                    />

                                    <button
                                        type="button"
                                        aria-label={
                                            showPassword.new
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                        onClick={() =>
                                            setShowPassword(prev => ({
                                                ...prev,
                                                new: !prev.new
                                            }))
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                        {showPassword.new ? (
                                            <Eye className="w-5 h-5" />
                                        ) : (
                                            <EyeOff className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Confirm New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword.confirm ? "text" : "password"}
                                        required
                                        value={passwordData.confirmPassword}
                                        onChange={(e) =>
                                            setPasswordData({
                                                ...passwordData,
                                                confirmPassword: e.target.value
                                            })
                                        }
                                        className="w-full bg-secondary border border-border focus:border-primary outline-none transition-colors rounded-xl px-4 py-2.5 pr-12 text-foreground text-sm shadow-sm"
                                    />

                                    <button
                                        type="button"
                                        aria-label={
                                            showPassword.confirm
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                        onClick={() =>
                                            setShowPassword(prev => ({
                                                ...prev,
                                                confirm: !prev.confirm
                                            }))
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                        {showPassword.confirm ? (
                                            <Eye className="w-5 h-5" />
                                        ) : (
                                            <EyeOff className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {passwordMsg.text && (
                                <div className={`p-3 rounded-lg text-sm font-bold flex items-center gap-2 ${passwordMsg.type === 'error' ? 'bg-destructive/10 text-destructive' : passwordMsg.type === 'warning' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>
                                    {passwordMsg.type === 'error' ? <ShieldAlert className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                                    {passwordMsg.text}
                                </div>
                            )}

                            <button type="submit" disabled={isUpdatingPassword || !passwordData.newPassword || !passwordData.oldPassword} className="w-full px-8 py-3 rounded-xl font-bold text-primary-foreground bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-4 sm:mt-6 cursor-pointer text-sm sm:text-base shadow-sm">
                                {isUpdatingPassword && <Loader2 className="w-4 h-4 animate-spin" />} Update Password
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* TAB: SUBSCRIPTION */}
            {activeTab === "subscription" && (
                <div className="animate-in fade-in duration-500 space-y-6 sm:space-y-8">
                    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-foreground">Current Plan</h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <p className="text-muted-foreground text-xs sm:text-sm">
                                    You are currently subscribed to the <span className="text-foreground font-bold capitalize">{profileData.plan ? profileData.plan.toLowerCase() : 'Starter'} Plan</span>.
                                </p>
                                <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded border border-primary/30 uppercase">Active</span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                            <button onClick={() => alert("Redirecting to secure billing portal to view tax invoices... (Simulated in Demo)")} className="w-full sm:w-auto px-4 py-2 border border-border rounded-lg text-foreground text-sm hover:bg-muted transition-colors cursor-pointer justify-center text-center">
                                View Invoices
                            </button>

                            {(profileData.plan || "STARTER") !== "STARTER" && (
                                <button onClick={handleCancelSubscription} className="w-full sm:w-auto px-4 py-2 border border-destructive/50 text-destructive/90 rounded-lg text-sm hover:bg-destructive/10 transition-colors cursor-pointer justify-center text-center">
                                    Cancel Sub
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start relative">

                        {/* STARTER CARD */}
                        <div className={`bg-card border ${(profileData.plan || 'STARTER') === 'STARTER' ? 'border-primary/50 shadow-md' : 'border-border'} rounded-2xl p-6 sm:p-8 flex flex-col`}>
                            <div className="mb-4 sm:mb-6">
                                <h4 className="text-muted-foreground text-base sm:text-lg mb-1 sm:mb-2">Starter</h4>
                                <div className="text-2xl sm:text-3xl font-bold text-foreground">Free</div>
                            </div>
                            <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 text-xs sm:text-sm text-muted-foreground flex-1">
                                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Single User (No Staff)</li>
                                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Max 5 Catalog Medicines</li>
                                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Max 2 Dealers/Suppliers</li>
                                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Basic Billing & Inventory</li>
                            </ul>
                            <button onClick={() => handlePlanUpdate('STARTER')} disabled={(profileData.plan || 'STARTER') === 'STARTER'} className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${(profileData.plan || 'STARTER') === 'STARTER' ? 'bg-primary/10 text-primary border border-primary/30 cursor-not-allowed' : 'border border-border text-foreground hover:bg-muted cursor-pointer'}`}>
                                {(profileData.plan || 'STARTER') === 'STARTER' ? 'Current Plan' : 'Start Free Trial'}
                            </button>
                        </div>

                        {/* GROWTH CARD */}
                        <div className={`bg-card border-2 ${(profileData.plan || 'STARTER') === 'GROWTH' ? 'border-primary shadow-md' : 'border-primary/60'} rounded-2xl p-6 sm:p-8 flex flex-col relative`}>
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase px-3 py-1 rounded-full whitespace-nowrap">Most Popular</div>
                            <div className="mb-4 sm:mb-6">
                                <h4 className="text-primary text-base sm:text-lg mb-1 sm:mb-2">Growth</h4>
                                <div className="text-2xl sm:text-3xl font-bold text-foreground">Rs 599 <span className="text-xs sm:text-sm font-normal text-muted-foreground">/mo</span></div>
                            </div>
                            <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 text-xs sm:text-sm text-muted-foreground flex-1">
                                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Up to 5 Staff Accounts</li>
                                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Max 50 Catalog Medicines</li>
                                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Max 10 Dealers/Suppliers</li>
                                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Advanced FEFO Alerts</li>
                            </ul>
                            <button onClick={() => handlePlanUpdate('GROWTH')} disabled={profileData.plan === 'GROWTH'} className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${profileData.plan === 'GROWTH' ? 'bg-primary/20 text-primary border border-primary/30 cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm cursor-pointer'}`}>
                                {profileData.plan === 'GROWTH' ? 'Current Plan' : 'Select Growth'}
                            </button>
                        </div>

                        {/* PRO CARD */}
                        <div className={`bg-card border ${profileData.plan === 'PRO' ? 'border-primary/50 shadow-md' : 'border-border'} rounded-2xl p-6 sm:p-8 flex flex-col`}>
                            <div className="mb-4 sm:mb-6">
                                <h4 className="text-muted-foreground text-base sm:text-lg mb-1 sm:mb-2">Pro</h4>
                                <div className="text-2xl sm:text-3xl font-bold text-foreground">Rs 1499 <span className="text-xs sm:text-sm font-normal text-muted-foreground">/mo</span></div>
                            </div>
                            <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 text-xs sm:text-sm text-muted-foreground flex-1">
                                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Unlimited Staff, SKUs & Dealers</li>
                                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> StockEasy AI Assistant Access</li>
                                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Full Enterprise Analytics</li>
                                <li className="flex items-center gap-2 sm:gap-3"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> 24/7 Priority Support</li>
                            </ul>
                            <button onClick={() => handlePlanUpdate('PRO')} disabled={profileData.plan === 'PRO'} className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${profileData.plan === 'PRO' ? 'bg-primary/10 text-primary border border-primary/30 cursor-not-allowed' : 'border border-border text-foreground hover:bg-muted cursor-pointer'}`}>
                                {profileData.plan === 'PRO' ? 'Current Plan' : 'Select Pro'}
                            </button>
                        </div>
                    </div>
                    <p className="text-center text-[10px] sm:text-xs text-muted-foreground pt-4">All plans are billed securely. Prices exclude applicable taxes.</p>
                </div>
            )}
        </div>
    );
}