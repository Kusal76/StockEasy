"use client";

import { useState, useEffect, Suspense } from "react";
import { Mail, Lock, EyeOff, Eye, ArrowRight, CheckCircle2, ShieldCheck, AlertCircle, AlertTriangle, Loader2, Users, Smartphone, QrCode } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

// We wrap the main logic in a component so we can safely use useSearchParams inside a Suspense boundary
function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [loginMode, setLoginMode] = useState<"portal" | "admin">("portal");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const [errorMsg, setErrorMsg] = useState("");
    const [rememberMe, setRememberMe] = useState(true);

    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [pendingRole, setPendingRole] = useState("");

    // --- 2FA VERIFICATION STATES (Returning Users) ---
    const [show2FA, setShow2FA] = useState(false);
    const [otpCode, setOtpCode] = useState("");

    // --- 2FA SETUP STATES (First-Time Onboarding) ---
    const [show2FASetup, setShow2FASetup] = useState(false);
    const [qrCodeSvg, setQrCodeSvg] = useState("");
    const [factorId, setFactorId] = useState("");

    // --- CHECK URL FOR KICKOUT ERRORS ---
    useEffect(() => {
        const urlError = searchParams.get('error');
        if (urlError) {
            setErrorMsg(decodeURIComponent(urlError));
            // Optional: Clean the URL so the error doesn't persist on refresh
            router.replace('/login');
        }
    }, [searchParams, router]);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/system/status', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (data && typeof data.maintenanceMode === 'boolean') {
                        setMaintenanceMode(data.maintenanceMode);
                    }
                }
            } catch (err) {
                console.error("Failed to check maintenance status");
            }
        };
        checkStatus();
    }, []);

    useEffect(() => {
        let isMounted = true;

        const checkExistingSession = async () => {
            try {
                // If they were just kicked out and have an error, don't auto-redirect them
                if (searchParams.get('error')) {
                    if (isMounted) setIsCheckingSession(false);
                    return;
                }

                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) throw new Error("No valid session");

                const { data: platformData } = await supabase
                    .from('platform_admins')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle();

                let role = "STAFF";

                if (platformData?.role) {
                    role = platformData.role.toUpperCase();
                } else {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('role')
                        .eq('id', user.id)
                        .maybeSingle();

                    if (userData?.role) {
                        role = userData.role.toUpperCase();
                    }
                }

                if (role === "ADMIN" || role === "SUPERADMIN") {
                    window.location.href = "/admin";
                } else {
                    window.location.href = "/dashboard";
                }
            } catch (err) {
                await supabase.auth.signOut();
                if (isMounted) setIsCheckingSession(false);
            }
        };

        checkExistingSession();
        return () => { isMounted = false; };
    }, [searchParams]);

    const routeUser = (role: string) => {
        setTimeout(() => {
            if (role === "ADMIN" || role === "SUPERADMIN") {
                router.push("/admin");
            } else {
                router.push("/dashboard");
            }
        }, 100);
    };

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorMsg("");
        setIsLoading(true);

        try {
            document.cookie = `stockeasy_remember_me=${rememberMe}; path=/; max-age=60; SameSite=Lax; Secure`;

            const preCheckRes = await fetch('/api/auth/security', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, action: 'check' })
            });
            const preCheckData = await preCheckRes.json();

            if (preCheckData.locked) {
                throw new Error(`Account temporarily locked due to multiple failed attempts. Try again in ${preCheckData.minutesLeft} minutes.`);
            }

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email, password,
            });

            if (authError || !authData.user) {
                const failRes = await fetch('/api/auth/security', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, action: 'fail' })
                });
                const failData = await failRes.json();

                if (failData.locked) {
                    throw new Error(`Account locked. Too many failed attempts. Try again in 15 minutes.`);
                } else if (failData.attemptsLeft !== undefined) {
                    throw new Error(`Invalid credentials. ${failData.attemptsLeft} attempts remaining before lockout.`);
                }
                throw new Error("Invalid login credentials.");
            }

            await fetch('/api/auth/security', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, action: 'success' })
            });

            // Fetch profile to get shop_id
            const { data: profile } = await supabase.from('users').select('shop_id').eq('id', authData.user.id).single();

            if (profile?.shop_id) {
                // --- FIXED: LIGHTNING REDIS BLACKLIST CHECK ---
                let isBlacklisted = false;
                try {
                    const banRes = await fetch(`/api/auth/check-blacklist?shopId=${profile.shop_id}`);
                    if (banRes.ok) {
                        const banData = await banRes.json();
                        isBlacklisted = banData.isBlacklisted;
                    }
                } catch (redisError) {
                    console.error("Redis check failed during login", redisError);
                    // Silently fail open and let Supabase fallback handle it
                }

                // Move the actual block/throw OUTSIDE the try/catch so it doesn't swallow its own error!
                if (isBlacklisted) {
                    await supabase.auth.signOut();
                    throw new Error("Access Denied: Your pharmacy account has been suspended by the platform administrator.");
                }

                // Fallback check against database (using maybeSingle in case RLS hides it)
                const { data: shopData } = await supabase.from('shops').select('status').eq('id', profile.shop_id).maybeSingle();

                if (shopData?.status === 'SUSPENDED') {
                    await supabase.auth.signOut();
                    throw new Error("Access Denied: Your pharmacy account has been suspended by the platform administrator.");
                }

                if (shopData?.status === 'PENDING_DELETION') {
                    await supabase.auth.signOut();
                    throw new Error("Account has been deactivated and is scheduled for deletion. Contact support for recovery.");
                }
            }

            let userRole = preCheckData.role?.toUpperCase() || "STAFF";
            let needsPasswordReset = false;

            if (loginMode === "admin") {
                const { data: platformAdmin } = await supabase
                    .from('platform_admins')
                    .select('role, is_active, requires_password_change')
                    .eq('id', authData.user.id)
                    .maybeSingle();

                if (platformAdmin) {
                    if (!platformAdmin.is_active) {
                        await supabase.auth.signOut();
                        throw new Error("Account suspended by System Administration.");
                    }
                    userRole = platformAdmin.role.toUpperCase();
                    needsPasswordReset = platformAdmin.requires_password_change;
                } else {
                    const { data: uAdmin } = await supabase.from('users').select('role').eq('id', authData.user.id).maybeSingle();
                    if (uAdmin) userRole = uAdmin.role.toUpperCase();
                }
            }

            setPendingRole(userRole);

            if (userRole === "STAFF") {
                const { data: staffProfile } = await supabase
                    .from('staff_profiles')
                    .select('status')
                    .eq('id', authData.user.id)
                    .single();

                if (staffProfile && staffProfile.status === 'SUSPENDED') {
                    await supabase.auth.signOut();
                    throw new Error("Your account has been SUSPENDED by the pharmacy owner. Please contact them to restore access.");
                }
            }

            const isMaintenance = preCheckData.settings?.maintenance_mode;
            if (isMaintenance && userRole !== "ADMIN" && userRole !== "SUPERADMIN") {
                await supabase.auth.signOut();
                throw new Error("System is currently down for scheduled maintenance. Please try again later.");
            }

            if (loginMode === "admin" && userRole !== "ADMIN" && userRole !== "SUPERADMIN") {
                await supabase.auth.signOut();
                throw new Error("Unauthorized Access: Administrator privileges required.");
            }

            if (needsPasswordReset) {
                routeUser(userRole);
                return;
            }

            const { data: factorsData } = await supabase.auth.mfa.listFactors();
            const hasVerifiedTOTP = factorsData?.totp?.some((factor: any) => factor.status === 'verified');
            const requiresGlobal2FA = preCheckData.settings?.require_2fa;
            const isAdmin = userRole === "ADMIN" || userRole === "SUPERADMIN";

            if (!hasVerifiedTOTP && (isAdmin || (userRole === "OWNER" && requiresGlobal2FA))) {
                const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
                if (enrollError) throw new Error("Failed to generate security QR code.");

                setQrCodeSvg(enrollData.totp.qr_code);
                setFactorId(enrollData.id);
                setShow2FASetup(true);
                setIsLoading(false);
                return;
            }

            if (hasVerifiedTOTP && (isAdmin || (userRole === "OWNER" && requiresGlobal2FA))) {
                setShow2FA(true);
                setIsLoading(false);
                return;
            }

            routeUser(userRole);

        } catch (error: any) {
            console.error("Login Error:", error);
            setErrorMsg(error.message || "An unexpected error occurred.");
            setIsLoading(false);
        }
    };

    const handleVerifySetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");
        setIsLoading(true);

        try {
            if (otpCode.length !== 6) throw new Error("Invalid code format.");

            const { error: challengeError } = await supabase.auth.mfa.challengeAndVerify({
                factorId: factorId,
                code: otpCode,
            });

            if (challengeError) throw challengeError;

            routeUser(pendingRole);

        } catch (error: any) {
            setErrorMsg("Invalid setup code. Try syncing your Authenticator app time.");
            setIsLoading(false);
        }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");
        setIsLoading(true);

        try {
            if (otpCode.length !== 6) throw new Error("Invalid Authenticator code format.");

            const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
            if (factorsError) throw factorsError;

            const totpFactor = factorsData.totp.find((factor: any) => factor.status === 'verified');
            if (!totpFactor) throw new Error("No Authenticator app linked to this account. Contact SuperAdmin.");

            const { error: challengeError } = await supabase.auth.mfa.challengeAndVerify({
                factorId: totpFactor.id,
                code: otpCode,
            });

            if (challengeError) throw challengeError;

            routeUser(pendingRole);

        } catch (error: any) {
            console.error("MFA Error:", error);
            setErrorMsg(error.message || "Invalid Authenticator code. Please try again.");
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setErrorMsg("");
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${window.location.origin}/auth/callback` }
            });
            if (error) throw error;
        } catch (error: any) {
            console.error("Google Auth Error:", error);
            setErrorMsg("Failed to initialize Google Sign-In.");
            setIsLoading(false);
        }
    };

    return (
        <div className="h-[100dvh] w-full bg-background flex transition-colors duration-300 overflow-hidden">
            {/* LEFT COLUMN: Branding & Value Prop */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-card border-r border-border flex-col justify-between p-12 h-full transition-colors duration-300">
                <div className="relative z-10">
                    <div className="mb-24 flex items-start">
                        <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
                            <Image src="/Receipt_logo.png" alt="StockEasy Logo" width={130} height={40} className="object-contain object-left block dark:hidden scale-125 origin-left" priority />
                            <Image src="/StockEasy_logo.png" alt="StockEasy Logo" width={150} height={40} className="object-contain object-left hidden dark:block" priority />
                        </Link>
                    </div>

                    <h1 className="text-4xl font-bold text-foreground leading-tight mb-6">
                        The intelligent operating system for modern pharmacies.
                    </h1>
                    <p className="text-lg text-muted-foreground mb-12 max-w-md font-medium">
                        Manage inventory, prevent expiry losses, and streamline your billing with AI-powered insights.
                    </p>

                    <div className="space-y-5">
                        <div className="flex items-center gap-3 text-foreground font-medium"><CheckCircle2 className="w-5 h-5 text-primary" /> Auto-FEFO Batch Routing</div>
                        <div className="flex items-center gap-3 text-foreground font-medium"><CheckCircle2 className="w-5 h-5 text-primary" /> Smart Expiry Alerts</div>
                        <div className="flex items-center gap-3 text-foreground font-medium"><CheckCircle2 className="w-5 h-5 text-primary" /> Real-time Margin Analytics</div>
                    </div>
                </div>

                <div className="relative z-10">
                    <p className="text-sm text-muted-foreground font-medium">© {new Date().getFullYear()} StockEasy Technologies. All rights reserved.</p>
                </div>
            </div>

            {/* RIGHT COLUMN: Tabbed Login Form */}
            <div className="w-full lg:w-1/2 h-full overflow-y-auto custom-scrollbar flex flex-col p-4 sm:p-8 md:p-12 relative">
                {/* Global Loading Overlay */}
                {isCheckingSession && !show2FA && !show2FASetup && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                        <p className="text-sm font-mono text-primary uppercase tracking-widest font-bold">Checking Session...</p>
                    </div>
                )}

                <div className="w-full max-w-md m-auto bg-card sm:bg-transparent border border-border sm:border-0 rounded-2xl p-5 sm:p-0 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-sm sm:shadow-none transition-colors">

                    {/* Mobile Logo */}
                    <div className="flex lg:hidden justify-center mb-6 sm:mb-8 pt-2 sm:pt-0">
                        <Link href="/" className="inline-block">
                            <Image src="/Receipt_logo.png" alt="StockEasy Logo" width={130} height={40} className="object-contain block dark:hidden scale-110 sm:scale-125" priority />
                            <Image src="/StockEasy_logo.png" alt="StockEasy Logo" width={150} height={40} className="object-contain hidden dark:block" priority />
                        </Link>
                    </div>

                    {!show2FA && !show2FASetup && (
                        <>
                            <div className="flex mb-6 sm:mb-8 border-b border-border">
                                <button type="button" onClick={() => setLoginMode("portal")} className={`flex-1 pb-3 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${loginMode === "portal" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
                                    Pharmacy Portal
                                </button>
                                <button type="button" onClick={() => setLoginMode("admin")} className={`flex-1 pb-3 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${loginMode === "admin" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
                                    System Admin
                                </button>
                            </div>

                            <div className="hidden sm:flex flex-col items-center justify-center mb-6">
                                <div className="mb-7">
                                    <Image src="/Receipt_logo.png" alt="StockEasy Logo" width={130} height={40} className="object-contain block dark:hidden scale-125" priority />
                                    <Image src="/StockEasy_logo.png" alt="StockEasy Logo" width={150} height={40} className="object-contain hidden dark:block" priority />
                                </div>
                                <p className="text-muted-foreground text-sm mt-2 flex items-center gap-2 font-medium">
                                    {loginMode === "portal" ? <><Users className="w-4 h-4 text-primary shrink-0" /> Secure login for Owners & Staff</> : <><ShieldCheck className="w-4 h-4 text-primary shrink-0" /> Central administrative access</>}
                                </p>
                            </div>

                            {maintenanceMode && (
                                <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
                                    <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-warning">Maintenance Mode Active</p>
                                        <p className="text-xs text-warning/80 mt-1 font-medium">Tenant logins are currently disabled. Only system administrators can bypass this lock.</p>
                                    </div>
                                </div>
                            )}

                            {errorMsg && (
                                <div className="mb-6 p-3 sm:p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
                                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive flex-shrink-0" />
                                    <p className="text-xs sm:text-sm font-bold text-destructive">{errorMsg}</p>
                                </div>
                            )}

                            {loginMode === "portal" && !maintenanceMode && (
                                <div>
                                    <button type="button" onClick={handleGoogleLogin} disabled={isLoading || isCheckingSession} className="w-full flex items-center justify-center gap-3 bg-card border border-border text-foreground font-bold py-3 sm:py-3.5 rounded-xl hover:bg-muted transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-sm text-sm sm:text-base">
                                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                        Continue with Google
                                    </button>

                                    <div className="relative flex items-center py-4 sm:py-5">
                                        <div className="flex-grow border-t border-border"></div>
                                        <span className="flex-shrink-0 mx-4 text-muted-foreground text-[10px] sm:text-xs font-bold uppercase tracking-wider">Or email & password</span>
                                        <div className="flex-grow border-t border-border"></div>
                                    </div>
                                </div>
                            )}

                            <form action="#" method="POST" className="space-y-4 sm:space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            type="email"
                                            name="email"
                                            autoComplete="username"
                                            placeholder={loginMode === "portal" ? "name@pharmacy.com" : "admin@stockeasy.com"}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={isLoading || isCheckingSession}
                                            className="w-full pl-10 sm:pl-11 pr-4 py-3 sm:py-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/50 disabled:opacity-50 shadow-sm"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Password</label>
                                        <Link href="/forgot-password" className="text-[10px] sm:text-xs text-primary hover:underline font-bold">Forgot password?</Link>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            name="password"
                                            autoComplete="current-password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            disabled={isLoading || isCheckingSession}
                                            className="w-full pl-10 sm:pl-11 pr-12 py-3 sm:py-3.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/50 disabled:opacity-50 shadow-sm"
                                            required
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1">
                                            {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 sm:gap-3 pt-1 sm:pt-2">
                                    <input
                                        type="checkbox"
                                        id="remember"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded border-border bg-background checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                    />
                                    <label htmlFor="remember" className="text-xs sm:text-sm text-muted-foreground cursor-pointer select-none font-medium">
                                        Remember me for 30 days
                                    </label>
                                </div>

                                {loginMode === "admin" && (
                                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 sm:p-4 flex gap-2 sm:gap-3 mt-4 shadow-sm">
                                        <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                                        <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed font-medium">System administrators must provide a valid authenticator app code (TOTP) after entering their credentials.</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    onClick={(e) => handleLogin(e)}
                                    disabled={isLoading || isCheckingSession || !email || !password}
                                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 sm:py-3.5 rounded-xl hover:bg-primary/90 transition-all shadow-sm mt-4 sm:mt-6 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer text-sm sm:text-base"
                                >
                                    {isLoading ? <><Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> Authenticating...</> : <>Login <ArrowRight className="w-4 h-4" /></>}
                                </button>
                            </form>

                            {loginMode === "portal" && !maintenanceMode && (
                                <p className="text-center text-xs sm:text-sm text-muted-foreground mt-6 sm:mt-8 font-medium">
                                    New pharmacy owner? <Link href="/register" className="text-primary font-bold hover:underline">Register your shop</Link>
                                </p>
                            )}
                        </>
                    )}

                    {/* --- ONBOARDING: FIRST-TIME 2FA SETUP --- */}
                    {show2FASetup && (
                        <div className="animate-in slide-in-from-right-8 duration-500">
                            <div className="text-center mb-6">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                    <QrCode className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                                </div>
                                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Secure Your Account</h2>
                                <p className="text-muted-foreground text-xs sm:text-sm font-medium px-2 sm:px-4">As a Pharmacy Owner, you are required to secure your account with Two-Factor Authentication before accessing the dashboard.</p>
                            </div>

                            {errorMsg && (
                                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 animate-in fade-in shadow-sm">
                                    <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                                    <p className="text-xs font-bold text-destructive">{errorMsg}</p>
                                </div>
                            )}

                            <div className="bg-card border border-border p-4 sm:p-5 rounded-2xl shadow-sm mb-6">
                                <h3 className="text-xs sm:text-sm font-bold text-foreground mb-3 text-center">Step 1: Scan this QR Code</h3>
                                <div className="bg-white p-2 sm:p-3 rounded-xl mx-auto w-fit mb-4 shadow-sm" dangerouslySetInnerHTML={{ __html: qrCodeSvg }} />

                                <form onSubmit={handleVerifySetup} className="space-y-4 pt-4 border-t border-border">
                                    <div className="space-y-2">
                                        <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider text-center block">Step 2: Enter 6-Digit Code</label>
                                        <input
                                            type="text"
                                            maxLength={6}
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                            disabled={isLoading}
                                            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 sm:py-3 text-foreground text-lg sm:text-xl font-mono text-center tracking-[0.3em] sm:tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50 shadow-sm"
                                            placeholder="000000"
                                            autoFocus
                                        />
                                    </div>

                                    <button type="submit" disabled={isLoading || otpCode.length !== 6} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-2.5 sm:py-3 rounded-xl hover:bg-primary/90 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer text-sm sm:text-base">
                                        {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : <>Secure & Enter <ArrowRight className="w-4 h-4" /></>}
                                    </button>
                                </form>
                            </div>

                            <button type="button" onClick={async () => { await supabase.auth.signOut(); setShow2FASetup(false); }} className="w-full text-muted-foreground hover:text-foreground text-xs sm:text-sm font-bold transition-colors cursor-pointer">
                                Cancel and sign out
                            </button>
                        </div>
                    )}

                    {/* --- STANDARD: RETURNING USER 2FA --- */}
                    {show2FA && !show2FASetup && (
                        <div className="animate-in slide-in-from-right-8 duration-500">
                            <div className="text-center mb-6 sm:mb-8">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-sm">
                                    <Smartphone className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                                </div>
                                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Two-Factor Authentication</h2>
                                <p className="text-muted-foreground text-xs sm:text-sm max-w-sm mx-auto font-medium px-2">Your account role requires enhanced security. Please enter the 6-digit code from your Authenticator app.</p>
                            </div>

                            {errorMsg && (
                                <div className="mb-6 p-3 sm:p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-3 animate-in fade-in shadow-sm">
                                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive flex-shrink-0" />
                                    <p className="text-xs sm:text-sm font-bold text-destructive">{errorMsg}</p>
                                </div>
                            )}

                            <form onSubmit={handleVerify2FA} className="space-y-4 sm:space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider text-center block">Authenticator Code</label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        disabled={isLoading}
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 sm:py-4 text-foreground text-xl sm:text-2xl font-mono text-center tracking-[0.3em] sm:tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50 shadow-sm"
                                        placeholder="000000"
                                        autoFocus
                                    />
                                </div>

                                <button type="submit" disabled={isLoading || otpCode.length !== 6} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 sm:py-3.5 rounded-xl hover:bg-primary/90 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer text-sm sm:text-base">
                                    {isLoading ? <><Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> Verifying Token...</> : <>Verify & Secure Login <ShieldCheck className="w-4 h-4" /></>}
                                </button>

                                <button type="button" onClick={async () => { await supabase.auth.signOut(); setShow2FA(false); }} className="w-full text-muted-foreground hover:text-foreground text-xs sm:text-sm font-bold mt-4 transition-colors cursor-pointer">
                                    Cancel and return to login
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <LoginForm />
        </Suspense>
    );
}