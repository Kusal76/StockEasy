"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, UploadCloud, FileText, Eye, EyeOff, Trash2, Download, AlertCircle, Check, ShieldAlert, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabase";
import Image from "next/image";
import Link from "next/link";

// Helper function remains unchanged
const uploadDocument = async (file: File, folderName: string, userId: string) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${folderName}/${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

    const { data, error } = await supabase.storage
        .from('shop_documents')
        .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
        .from('shop_documents')
        .getPublicUrl(fileName);

    return publicUrl;
};

export default function ShopRegistrationPage() {
    // --- PLATFORM STATUS ENFORCEMENT STATES ---
    const [isCheckingStatus, setIsCheckingStatus] = useState(true);
    const [onboardingEnabled, setOnboardingEnabled] = useState(true);

    // Existing form states
    const [currentStep, setCurrentStep] = useState(1);
    const [errorMsg, setErrorMsg] = useState("");
    const [applicationId, setApplicationId] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // UI states
    const [showPassword, setShowPassword] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [declaredTruth, setDeclaredTruth] = useState(false);

    const [formData, setFormData] = useState({
        fullName: "", email: "", password: "", contact: "", altContact: "", dob: "",
        shopName: "", businessType: "Retail Pharmacy", pan: "", gst: "", license: "", licenseExpiry: "", address: "",
        drugLicenseFile: null as File | null,
        panFile: null as File | null,
        gstFile: null as File | null,
        shopPhotoFile: null as File | null,
    });

    // --- PLATFORM STATUS CHECK (PRODUCTION GRADE) ---
    useEffect(() => {
        const checkSystemStatus = async () => {
            try {
                const res = await fetch('/api/system/status');
                if (!res.ok) throw new Error("Status check failed");
                const data = await res.json();

                if (data && typeof data.onboardingEnabled === 'boolean') {
                    setOnboardingEnabled(data.onboardingEnabled);
                }
            } catch (error) {
                console.error("Failed to check system status:", error);
            } finally {
                setTimeout(() => setIsCheckingStatus(false), 500);
            }
        };
        checkSystemStatus();
    }, []);

    // --- NEW: ASYNC HANDLE NEXT WITH GLOBAL EMAIL CHECK ---
    const handleNext = async () => {
        setErrorMsg("");

        if (currentStep === 1) {
            if (!formData.fullName || !formData.email || !formData.password || !formData.contact || !formData.dob) return setErrorMsg("Please fill all mandatory fields to continue.");
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return setErrorMsg("Please enter a valid email address.");
            if (formData.password.length < 6) return setErrorMsg("Password must be at least 6 characters long.");
            if (formData.contact.length !== 10) return setErrorMsg("Contact number must be exactly 10 digits.");

            // Check email uniqueness before proceeding
            setIsSubmitting(true);
            try {
                const res = await fetch('/api/auth/check-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: formData.email })
                });

                // Only parse if we get a valid JSON response
                if (res.ok) {
                    const data = await res.json();
                    if (!data.isAvailable) {
                        setIsSubmitting(false);
                        return setErrorMsg(`Cannot use this email: ${data.reason}`);
                    }
                } else {
                    // Fallback if the endpoint isn't fully set up yet
                    console.warn("Email check endpoint not found or failed. Proceeding...");
                }
            } catch (error) {
                console.error("Email verification failed:", error);
                setIsSubmitting(false);
                return setErrorMsg("Failed to verify email with the server. Please try again.");
            }
            setIsSubmitting(false);
        }

        if (currentStep === 2) {
            if (!formData.shopName || !formData.pan || !formData.gst || !formData.license || !formData.licenseExpiry || !formData.address)
                return setErrorMsg("Please fill all mandatory business information.");
        }

        if (currentStep === 3) {
            if (!formData.drugLicenseFile || !formData.panFile || !formData.gstFile || !formData.shopPhotoFile) return setErrorMsg("Please upload all mandatory regulatory documents.");
        }

        setCurrentStep((prev) => Math.min(prev + 1, 4));
    };

    const prevStep = () => {
        setErrorMsg("");
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    const handleStepClick = (targetStep: number) => {
        if (targetStep < currentStep) {
            setErrorMsg("");
            setCurrentStep(targetStep);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, key: keyof typeof formData) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 1024 * 1024) {
            setErrorMsg(`File ${file.name} exceeds the 1MB limit. Please upload a smaller file.`);
            return;
        }

        setErrorMsg("");
        setFormData({ ...formData, [key]: file });
    };

    const handleSubmit = async () => {
        setErrorMsg("");
        setIsSubmitting(true);
        try {
            await supabase.auth.signOut();

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            });
            if (authError) throw new Error(authError.message);
            const userId = authData.user?.id;
            if (!userId) throw new Error("Failed to generate user account context.");

            const [drugLicensePath, panPath, gstPath, shopPhotoPath] = await Promise.all([
                uploadDocument(formData.drugLicenseFile!, 'licenses', userId),
                uploadDocument(formData.panFile!, 'pans', userId),
                uploadDocument(formData.gstFile!, 'gsts', userId),
                uploadDocument(formData.shopPhotoFile!, 'photos', userId)
            ]);

            const { data: shopData, error: shopError } = await supabase.from('shops').insert({
                name: formData.shopName,
                business_type: formData.businessType,
                pan_number: formData.pan,
                gst_number: formData.gst,
                license_number: formData.license,
                license_expiry: formData.licenseExpiry,
                address: formData.address,
                doc_drug_license_url: drugLicensePath,
                doc_pan_url: panPath,
                doc_gst_url: gstPath,
                doc_shop_photo_url: shopPhotoPath,
                status: 'PENDING'
            }).select('id').single();

            if (shopError) throw new Error("Failed to save shop details: " + shopError.message);

            const { error: userProfileError } = await supabase.from('users').upsert({
                id: userId,
                shop_id: shopData.id,
                role: 'OWNER',
                full_name: formData.fullName,
                email: formData.email,
                contact_number: formData.contact,
                alt_contact_number: formData.altContact || null,
                date_of_birth: formData.dob
            });

            if (userProfileError) throw new Error("Failed to save user profile: " + userProfileError.message);

            const generatedAppId = `SE-APP-${shopData.id.split('-')[0].toUpperCase()}`;
            setApplicationId(generatedAppId);

            // --- TRIGGER PENDING VERIFICATION EMAIL (WITH X-RAY) ---
            try {
                const emailRes = await fetch('/api/emails/onboarding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: formData.email,
                        ownerName: formData.fullName,
                        shopName: formData.shopName,
                        applicationId: generatedAppId
                    })
                });

                if (!emailRes.ok) {
                    const errorData = await emailRes.json();
                    console.error("X-RAY EMAIL ERROR:", errorData);
                } else {
                    console.log("Welcome email sent successfully!");
                }
            } catch (emailError) {
                console.error("Network failed to dispatch welcome email.", emailError);
            }

            setCurrentStep(5);
        } catch (error: any) {
            console.error("Submission Error:", error);
            setErrorMsg(error.message || "An unexpected error occurred during submission.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadReceipt = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

        const colorPrimary = [16, 185, 129]; // Emerald 500
        const colorDarkText = [15, 23, 42];
        const colorMuted = [100, 116, 139];
        const colorBorder = [226, 232, 240];

        doc.setFillColor(250, 252, 253);
        doc.rect(0, 0, pageWidth, 297, "F");

        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 35, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
        doc.text("StockEasy", 20, 23);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text("CENTRAL ONBOARDING MANIFEST", 125, 22);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(colorBorder[0], colorBorder[1], colorBorder[2]);
        doc.roundedRect(20, 45, pageWidth - 40, 28, 3, 3, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
        doc.text("APPLICATION REFERENCE ID", 26, 54);

        doc.setFontSize(16);
        doc.setTextColor(colorDarkText[0], colorDarkText[1], colorDarkText[2]);
        doc.text(applicationId, 26, 65);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
        doc.text("SUBMISSION DATE", 115, 54);
        doc.text("CURRENT STATUS", 160, 54);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(colorDarkText[0], colorDarkText[1], colorDarkText[2]);
        doc.text(new Date().toLocaleDateString(), 115, 64);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(217, 119, 6);
        doc.text("PENDING AUDIT", 160, 64);

        let yPos = 85;

        const printSectionHeader = (title: string, y: number) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(15, 23, 42);
            doc.text(title, 20, y);
            doc.setDrawColor(colorPrimary[0], colorPrimary[1], colorPrimary[2]);
            doc.setLineWidth(0.5);
            doc.line(20, y + 3, pageWidth - 20, y + 3);
            return y + 12;
        };

        const printDataRow = (label: string, value: string, y: number) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
            doc.text(label, 20, y);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(colorDarkText[0], colorDarkText[1], colorDarkText[2]);
            doc.text(value || "N/A", 75, y);
            return y + 8;
        };

        yPos = printSectionHeader("OWNER PROFILE", yPos);
        yPos = printDataRow("FULL LEGAL NAME", formData.fullName, yPos);
        yPos = printDataRow("PRIMARY EMAIL", formData.email, yPos);
        yPos = printDataRow("CONTACT PHONE", `+91 ${formData.contact}`, yPos);
        yPos = printDataRow("ALTERNATE PHONE", formData.altContact ? `+91 ${formData.altContact}` : "None Specified", yPos);
        yPos = printDataRow("DATE OF BIRTH", formData.dob, yPos);

        yPos += 6;

        yPos = printSectionHeader("BUSINESS PROFILE", yPos);
        yPos = printDataRow("PHARMACY NAME", formData.shopName, yPos);
        yPos = printDataRow("BUSINESS MODEL", formData.businessType, yPos);
        yPos = printDataRow("INCOME TAX PAN", formData.pan.toUpperCase(), yPos);
        yPos = printDataRow("GST NUMBER", formData.gst.toUpperCase(), yPos);
        yPos = printDataRow("DRUG LICENSE NO.", formData.license.toUpperCase(), yPos);

        yPos += 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
        doc.text("REGISTERED ADDRESS", 20, yPos);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(colorDarkText[0], colorDarkText[1], colorDarkText[2]);
        const splitAddress = doc.splitTextToSize(formData.address, pageWidth - 95);
        doc.text(splitAddress, 75, yPos);
        yPos += (splitAddress.length * 5) + 6;

        yPos = printSectionHeader("SUBMITTED ATTACHMENTS", yPos);
        yPos = printDataRow("DRUG LICENSE", formData.drugLicenseFile?.name || "Missing", yPos);
        yPos = printDataRow("PAN CARD", formData.panFile?.name || "Missing", yPos);
        yPos = printDataRow("GST CERTIFICATE", formData.gstFile?.name || "Missing", yPos);
        yPos = printDataRow("STORE PHOTO", formData.shopPhotoFile?.name || "Missing", yPos);

        yPos += 10;
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(20, yPos, pageWidth - 40, 22, 2, 2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
        doc.text("COMPLIANCE DECLARATION", 24, yPos + 6);
        doc.setFont("helvetica", "normal");
        doc.text("The applicant acknowledges that all materials submitted are bound under the statutory regulations of drug control bodies.", 24, yPos + 12);
        doc.text("Any data manipulation detected during review will trigger instant application termination.", 24, yPos + 17);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(colorMuted[0], colorMuted[1], colorMuted[2]);
        doc.text("Generated securely via StockEasy Central Portal Hub Auto-Logger.", 20, 285);

        doc.save(`StockEasy_Manifest_${applicationId}.pdf`);
    };

    const handleViewFile = (file: File) => window.open(URL.createObjectURL(file), '_blank');

    // FIX: Optimized step indicator for mobile
    const StepIndicator = ({ stepNum, title }: { stepNum: number, title: string }) => {
        const isCompleted = currentStep > stepNum;
        const isActive = currentStep === stepNum;
        const isClickable = stepNum < currentStep;

        return (
            <div
                className={`flex flex-col items-center gap-1 sm:gap-2 z-10 relative ${isClickable ? 'cursor-pointer group' : ''}`}
                onClick={() => isClickable && handleStepClick(stepNum)}
            >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300 shadow-sm ${isCompleted ? "bg-primary border border-primary text-primary-foreground" :
                    isActive ? "bg-background border-2 border-primary text-primary" :
                        "bg-card text-muted-foreground border border-border"
                    } ${isClickable ? 'group-hover:ring-4 ring-primary/20' : ''}`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" /> : stepNum}
                </div>
                <span className={`text-[9px] sm:text-[11px] font-bold tracking-wider absolute -bottom-5 sm:-bottom-6 w-max transition-colors text-center ${isCompleted || isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {title}
                </span>
            </div>
        );
    };

    const FileUploadZone = ({ title, format, fileKey, accept }: { title: string, format: string, fileKey: keyof typeof formData, accept: string }) => (
        <div className="relative border border-dashed border-border hover:border-primary/50 rounded-xl p-4 sm:p-6 bg-background transition-all text-center flex flex-col items-center justify-center group h-40 shadow-sm">
            {formData[fileKey] ? (
                <div className="flex flex-col items-center w-full z-10 overflow-hidden">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary mb-2" />
                    <p className="text-xs sm:text-sm font-medium text-primary truncate w-full px-2 sm:px-4 mb-3 sm:mb-4">{(formData[fileKey] as File).name}</p>
                    <div className="flex gap-2 sm:gap-4">
                        <button type="button" onClick={() => handleViewFile(formData[fileKey] as File)} className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold bg-card text-foreground border border-border rounded hover:border-primary/50 transition-colors shadow-sm"><Eye className="w-3 h-3 sm:w-4 sm:h-4" /> View</button>
                        <button type="button" onClick={() => setFormData({ ...formData, [fileKey]: null })} className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20 rounded hover:bg-destructive/20 transition-colors shadow-sm"><Trash2 className="w-3 h-3 sm:w-4 sm:h-4" /> Remove</button>
                    </div>
                </div>
            ) : (
                <>
                    <input
                        type="file"
                        accept={accept}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
                        onChange={(e) => handleFileSelect(e, fileKey)}
                    />
                    <UploadCloud className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                    <p className="text-xs sm:text-sm font-bold text-foreground mb-1">{title} <span className="text-primary">*</span></p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">{format}</p>
                </>
            )}
        </div>
    );

    if (isCheckingStatus) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted-foreground font-sans transition-colors duration-300">
                <Loader2 className="w-10 h-10 animate-spin mb-6 text-primary" />
                <p className="font-mono text-sm tracking-widest uppercase font-bold">Initializing Onboarding Nexus...</p>
            </div>
        );
    }

    if (!onboardingEnabled) {
        return (
            <div className="min-h-screen flex flex-col bg-background text-foreground font-sans relative overflow-x-hidden transition-colors duration-300">

                <header className="fixed top-0 left-0 w-full h-20 border-b border-border bg-background/95 backdrop-blur-md z-50 shadow-sm flex items-center transition-colors">
                    <div className="w-full px-4 sm:px-8 lg:px-16">
                        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity cursor-pointer w-fit">
                            <Image src="/Receipt_logo.png" alt="StockEasy Logo" width={120} height={40} className="object-contain block dark:hidden scale-110 sm:scale-125 origin-left" priority />
                            <Image src="/StockEasy_logo.png" alt="StockEasy Logo" width={150} height={40} className="object-contain hidden dark:block" priority />
                        </Link>
                    </div>
                </header>

                <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 mt-20 pb-12">
                    <div className="max-w-md w-full bg-card border border-border p-6 sm:p-10 rounded-2xl text-center shadow-sm animate-in zoom-in-95 duration-500">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-sm">
                            <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4 tracking-tight">Onboarding Paused</h1>
                        <p className="text-muted-foreground mb-8 sm:mb-10 leading-relaxed text-xs sm:text-sm font-medium">
                            We are currently optimizing platform infrastructure due to high demand and have temporarily suspended new pharmacy registrations. We apologize for the inconvenience. Please check back later or contact support.
                        </p>
                        <div className="space-y-3 sm:space-y-4">
                            <Link href="/" className="inline-block w-full px-6 sm:px-8 py-3 sm:py-3.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm text-sm">
                                Return to Homepage
                            </Link>
                            <Link href="/login" className="inline-block w-full px-6 sm:px-8 py-3 sm:py-3.5 bg-background border border-border text-foreground hover:bg-muted font-bold rounded-xl transition-all shadow-sm text-sm">
                                Already Registered? Login
                            </Link>
                        </div>
                    </div>
                </main>

                <footer className="w-full border-t border-border bg-background text-muted-foreground text-[10px] sm:text-xs font-mono z-50 mt-auto transition-colors">
                    <div className="w-full flex flex-col md:flex-row justify-between items-center px-4 sm:px-8 lg:px-16 py-6 gap-4 font-bold">
                        <div className="flex justify-center text-center tracking-wide">
                            © {new Date().getFullYear()} StockEasy Technologies. All rights reserved.
                        </div>
                        <div className="flex justify-center flex-wrap gap-4 sm:gap-6">
                            <Link href="/privacy" target="_blank" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                            <Link href="/terms" target="_blank" className="hover:text-foreground transition-colors">Terms of Service</Link>
                            <Link href="/support" target="_blank" className="hover:text-foreground transition-colors">Support</Link>
                        </div>
                    </div>
                </footer>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-hidden transition-colors duration-300">

            <style jsx global>{`
                input[type="date"]::-webkit-calendar-picker-indicator {
                    cursor: pointer;
                    opacity: 0.6;
                    transition: opacity 0.2s;
                }
                .dark input[type="date"]::-webkit-calendar-picker-indicator {
                    filter: invert(1);
                }
                input[type="date"]::-webkit-calendar-picker-indicator:hover {
                    opacity: 1;
                }
            `}</style>

            {/* FIX: Header padding and text size for mobile */}
            <header className="fixed top-0 left-0 w-full h-20 border-b border-border bg-background/95 backdrop-blur-md z-50 shadow-sm flex items-center transition-colors">
                <div className="w-full flex justify-between items-center px-4 sm:px-8 lg:px-16">
                    <Link href="/" className="flex items-center hover:opacity-80 transition-opacity cursor-pointer">
                        <Image src="/Receipt_logo.png" alt="StockEasy Logo" width={120} height={40} className="object-contain block dark:hidden scale-110 sm:scale-125 origin-left" priority />
                        <Image src="/StockEasy_logo.png" alt="StockEasy Logo" width={150} height={40} className="object-contain hidden dark:block" priority />
                    </Link>
                    <Link href="/login" className="text-xs sm:text-sm font-bold text-primary hover:text-primary/80 transition-colors">
                        <span className="hidden sm:inline">Already registered? </span>Login
                    </Link>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center w-full pt-28 sm:pt-32 pb-12 px-4 z-10 relative">

                <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
                    {currentStep === 5 ? (
                        <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-sm p-6 sm:p-10 text-center animate-in zoom-in-95 duration-500 transition-colors">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Application Submitted!</h2>
                            <p className="text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8 font-medium px-2">Your registration details and documents have been securely sent to our central team for verification.</p>

                            <div className="bg-background border border-border shadow-sm rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 text-left transition-colors">
                                <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Application Reference ID</p>
                                <p className="text-lg sm:text-2xl font-mono font-bold text-primary tracking-wider break-all">{applicationId}</p>
                            </div>

                            <div className="flex flex-col gap-3 sm:gap-4">
                                <button onClick={handleDownloadReceipt} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 sm:px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 w-full shadow-sm cursor-pointer text-sm sm:text-base">
                                    <Download className="w-4 h-4 sm:w-5 sm:h-5" /> Download PDF Receipt
                                </button>
                                <button onClick={() => window.location.href = '/login'} className="bg-background border border-border text-foreground hover:bg-muted font-bold px-4 sm:px-6 py-3 rounded-xl transition-all w-full shadow-sm cursor-pointer text-sm sm:text-base">
                                    Return to Login
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-8 sm:mb-10">
                                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Shop Registration</h1>
                                <p className="text-muted-foreground text-xs sm:text-sm font-medium">Owner details; mandatory fields stored centrally</p>
                            </div>

                            {/* FIX: Form Card padding */}
                            <div className="w-full bg-card rounded-2xl border border-border shadow-sm p-5 sm:p-8 md:p-10 mb-8 overflow-hidden transition-colors">
                                <div className="mb-12 sm:mb-16 relative px-2 sm:px-8 md:px-12">
                                    <div className="relative flex justify-between items-center z-10">
                                        <div className="absolute top-1/2 left-3 right-3 sm:left-5 sm:right-5 h-[2px] bg-border -translate-y-1/2 -z-10 transition-colors">
                                            <div
                                                className="h-full bg-primary transition-all duration-500 ease-in-out"
                                                style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                                            />
                                        </div>
                                        <StepIndicator stepNum={1} title="Owner Details" />
                                        <StepIndicator stepNum={2} title="Business Info" />
                                        <StepIndicator stepNum={3} title="Documents" />
                                        <StepIndicator stepNum={4} title="Review" />
                                    </div>
                                </div>

                                {errorMsg && (
                                    <div className="mb-6 sm:mb-8 p-3 sm:p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
                                        <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive flex-shrink-0" />
                                        <p className="text-xs sm:text-sm font-bold text-destructive">{errorMsg}</p>
                                    </div>
                                )}

                                <div className="min-h-[350px]">
                                    {currentStep === 1 && (
                                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4 sm:mb-6 border-b border-border pb-2 sm:pb-3 transition-colors">Owner Details</h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                                <div><label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">Full Name <span className="text-primary">*</span></label><input type="text" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm" placeholder="e.g. Rajesh Kumar Sharma" /></div>
                                                <div><label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">Email Address <span className="text-primary">*</span></label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm" placeholder="rajesh@medicare.in" /></div>

                                                <div>
                                                    <label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">Secure Password <span className="text-primary">*</span></label>
                                                    <div className="relative group">
                                                        <input
                                                            type={showPassword ? "text" : "password"}
                                                            value={formData.password}
                                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                            className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 pr-12 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm"
                                                            placeholder="Min 6 characters"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1"
                                                        >
                                                            {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div><label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">Contact Number <span className="text-primary">*</span></label><input type="text" maxLength={10} value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value.replace(/\D/g, '') })} className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm" placeholder="10 digit number" /></div>
                                                <div><label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">Alternate Contact</label><input type="text" maxLength={10} value={formData.altContact} onChange={(e) => setFormData({ ...formData, altContact: e.target.value.replace(/\D/g, '') })} className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm" placeholder="Optional" /></div>
                                                <div><label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">Date of Birth <span className="text-primary">*</span></label><input type="date" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all shadow-sm" /></div>
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 2 && (
                                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4 sm:mb-6 border-b border-border pb-2 sm:pb-3 transition-colors">Business Info</h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                                <div><label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">Shop Name <span className="text-primary">*</span></label><input type="text" value={formData.shopName} onChange={(e) => setFormData({ ...formData, shopName: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm" placeholder="e.g. City Central Pharmacy" /></div>
                                                <div><label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">Business Type</label><select value={formData.businessType} onChange={(e) => setFormData({ ...formData, businessType: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all shadow-sm"><option>Retail Pharmacy</option><option>Wholesale Distributor</option></select></div>
                                                <div><label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">Business PAN <span className="text-primary">*</span></label><input type="text" maxLength={10} value={formData.pan} onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })} className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm font-mono" placeholder="ABCDE1234F" /></div>
                                                <div><label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">GST Number <span className="text-primary">*</span></label><input type="text" maxLength={15} value={formData.gst} onChange={(e) => setFormData({ ...formData, gst: e.target.value.toUpperCase() })} className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm font-mono" placeholder="15 char GSTIN" /></div>
                                                <div className="md:col-span-2"><label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">Drug License No. <span className="text-primary">*</span></label><input type="text" value={formData.license} onChange={(e) => setFormData({ ...formData, license: e.target.value.toUpperCase() })} className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm font-mono" placeholder="DL-1234567" /></div>
                                                <div className="md:col-span-1"><label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">License Expiry Date <span className="text-primary">*</span></label><input type="date" value={formData.licenseExpiry} onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all shadow-sm" /></div>
                                                <div className="md:col-span-2"><label className="block text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 sm:mb-2">Registered Address <span className="text-primary">*</span></label><textarea rows={3} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full bg-background border border-border rounded-xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all resize-none placeholder:text-muted-foreground/50 shadow-sm" placeholder="Full street address..." /></div>
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 3 && (
                                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4 sm:mb-6 border-b border-border pb-2 sm:pb-3 transition-colors">Upload Documents</h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                                <FileUploadZone title="Drug License" format="PDF/JPG (Max 1MB)" fileKey="drugLicenseFile" accept="image/jpeg,application/pdf" />
                                                <FileUploadZone title="Business PAN Card" format="PDF/JPG (Max 1MB)" fileKey="panFile" accept="image/jpeg,application/pdf" />
                                                <FileUploadZone title="GST Certificate" format="PDF/JPG (Max 1MB)" fileKey="gstFile" accept="image/jpeg,application/pdf" />
                                                <FileUploadZone title="Shop Photo" format="JPG/PNG (Max 1MB)" fileKey="shopPhotoFile" accept="image/jpeg,image/png" />
                                            </div>
                                        </div>
                                    )}

                                    {currentStep === 4 && (
                                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4 sm:mb-6 border-b border-border pb-2 sm:pb-3 transition-colors">Review & Declare</h2>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 mb-6 sm:mb-8">
                                                <div className="space-y-4 sm:space-y-6">
                                                    <div>
                                                        <h3 className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">Owner Profile</h3>
                                                        <div className="space-y-2 text-xs sm:text-sm text-foreground bg-background p-3 sm:p-4 rounded-xl border border-border shadow-sm transition-colors">
                                                            <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium shrink-0">Name</span> <span className="font-bold truncate">{formData.fullName}</span></div>
                                                            <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium shrink-0">Email</span> <span className="font-bold truncate">{formData.email}</span></div>
                                                            <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium shrink-0">Contact</span> <span className="font-bold shrink-0">+91 {formData.contact}</span></div>
                                                            {formData.altContact && (
                                                                <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium shrink-0">Alt Contact</span> <span className="font-bold shrink-0">+91 {formData.altContact}</span></div>
                                                            )}
                                                            <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium shrink-0">Date of Birth</span> <span className="font-bold shrink-0">{formData.dob}</span></div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">Business Profile</h3>
                                                        <div className="space-y-2 text-xs sm:text-sm text-foreground bg-background p-3 sm:p-4 rounded-xl border border-border shadow-sm transition-colors">
                                                            <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium shrink-0">Shop Name</span> <span className="font-bold truncate">{formData.shopName}</span></div>
                                                            <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium shrink-0">Business Type</span> <span className="font-bold truncate">{formData.businessType}</span></div>
                                                            <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium shrink-0">PAN</span> <span className="font-bold uppercase font-mono shrink-0">{formData.pan}</span></div>
                                                            <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium shrink-0">GST</span> <span className="font-bold uppercase font-mono shrink-0">{formData.gst}</span></div>
                                                            <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium shrink-0">Drug License</span> <span className="font-bold uppercase font-mono truncate">{formData.license}</span></div>
                                                            <div className="flex justify-between gap-4"><span className="text-muted-foreground font-medium shrink-0">License Expiry</span> <span className="font-bold shrink-0">{formData.licenseExpiry}</span></div>
                                                            <div className="flex justify-between gap-4 pt-2 mt-2 border-t border-border/40"><span className="text-muted-foreground font-medium shrink-0">Address</span> <span className="font-bold text-right leading-snug">{formData.address}</span></div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h3 className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">Submitted Documents</h3>
                                                    <div className="space-y-2 sm:space-y-3">
                                                        {[{ f: formData.drugLicenseFile, name: "Drug License" }, { f: formData.panFile, name: "PAN Card" }, { f: formData.gstFile, name: "GST Certificate" }, { f: formData.shopPhotoFile, name: "Shop Photo" }].map((item, i) => (
                                                            <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border border-border bg-background shadow-sm transition-colors gap-2">
                                                                <div className="flex items-center gap-2 sm:gap-3 overflow-hidden w-full sm:w-auto pr-2">
                                                                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                                                                    <span className="text-xs sm:text-sm font-bold truncate text-foreground">
                                                                        {item.f ? item.f.name : `${item.name} (Missing)`}
                                                                    </span>
                                                                </div>
                                                                {item.f && (
                                                                    <button type="button" onClick={() => handleViewFile(item.f as File)} className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-card border border-border text-foreground rounded hover:border-primary/50 transition-colors shadow-sm">
                                                                        <Eye className="w-3 h-3 sm:w-4 sm:h-4" /> View
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3 sm:space-y-4 bg-background p-4 sm:p-6 rounded-xl border border-border shadow-sm transition-colors">
                                                <label className="flex items-start gap-3 cursor-pointer group">
                                                    <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                                                        <input type="checkbox" className="sr-only" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                                                        <div className={`w-4 h-4 sm:w-5 sm:h-5 border-2 rounded flex items-center justify-center transition-all ${agreedToTerms ? 'border-primary bg-primary/10' : 'border-border bg-transparent group-hover:border-primary/50'}`}>
                                                            {agreedToTerms && <Check className="w-3 h-3 sm:w-4 sm:h-4 text-primary" strokeWidth={3} />}
                                                        </div>
                                                    </div>
                                                    <span className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed group-hover:text-foreground transition-colors">
                                                        I agree to the <Link href="/terms" target="_blank" onClick={(e) => e.stopPropagation()} className="text-primary hover:text-primary/80 underline decoration-primary/30 underline-offset-2 transition-colors font-bold">Rules and Regulations</Link> and <Link href="/privacy" target="_blank" onClick={(e) => e.stopPropagation()} className="text-primary hover:text-primary/80 underline decoration-primary/30 underline-offset-2 transition-colors font-bold">Privacy Policy</Link> of the StockEasy Central Platform.
                                                    </span>
                                                </label>

                                                <label className="flex items-start gap-3 cursor-pointer group">
                                                    <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                                                        <input type="checkbox" className="sr-only" checked={declaredTruth} onChange={(e) => setDeclaredTruth(e.target.checked)} />
                                                        <div className={`w-4 h-4 sm:w-5 sm:h-5 border-2 rounded flex items-center justify-center transition-all ${declaredTruth ? 'border-primary bg-primary/10' : 'border-border bg-transparent group-hover:border-primary/50'}`}>
                                                            {declaredTruth && <Check className="w-3 h-3 sm:w-4 sm:h-4 text-primary" strokeWidth={3} />}
                                                        </div>
                                                    </div>
                                                    <span className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed group-hover:text-foreground transition-colors">
                                                        I hereby declare that all information and documents provided in this application are true and correct to the best of my knowledge.
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* FIX: Stack buttons on mobile */}
                                <div className="flex flex-col-reverse sm:flex-row justify-between items-center mt-8 sm:mt-10 pt-5 sm:pt-6 border-t border-border transition-colors gap-3 sm:gap-0">
                                    <button onClick={prevStep} disabled={isSubmitting} className={`w-full sm:w-auto px-5 py-3 sm:py-2.5 text-sm font-bold transition-colors cursor-pointer rounded-xl sm:rounded-none border border-border sm:border-transparent ${currentStep === 1 ? "hidden sm:invisible sm:flex" : "text-muted-foreground hover:text-foreground disabled:opacity-50"}`}>
                                        ← Back
                                    </button>

                                    {currentStep === 4 ? (
                                        <button
                                            onClick={handleSubmit}
                                            disabled={isSubmitting || !agreedToTerms || !declaredTruth}
                                            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-3 sm:py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer text-sm sm:text-base"
                                        >
                                            {isSubmitting ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                                            {isSubmitting ? "Submitting..." : "Submit Application"}
                                        </button>
                                    ) : (
                                        <button onClick={handleNext} disabled={isSubmitting} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-3 sm:py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed text-sm sm:text-base">
                                            {isSubmitting && currentStep === 1 ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                            {isSubmitting && currentStep === 1 ? "Checking..." : "Next →"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>

            <footer className="w-full border-t border-border bg-background text-muted-foreground text-[10px] sm:text-xs z-50 mt-auto transition-colors">
                <div className="w-full flex flex-col md:flex-row justify-between items-center px-4 sm:px-8 lg:px-16 py-6 gap-4">
                    <div className="flex justify-center text-center font-medium">
                        © {new Date().getFullYear()} StockEasy Technologies. All rights reserved.
                    </div>
                    <div className="flex justify-center flex-wrap gap-4 sm:gap-6 font-bold">
                        <Link href="/privacy" target="_blank" className="hover:text-foreground transition-colors">Privacy</Link>
                        <Link href="/terms" target="_blank" className="hover:text-foreground transition-colors">Terms</Link>
                        <Link href="/support" target="_blank" className="hover:text-foreground transition-colors">Support</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}