import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);

    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';

    if (code) {
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) => {
                                cookieStore.set(name, value, options);
                            });
                        } catch (error) {
                            // Ignored: Called from a Server Component
                        }
                    },
                },
            }
        );

        // Exchange the Google code for a secure Supabase Session
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // CRITICAL FIX: PASSWORD RESET PRIORITY
            if (next.includes('/update-password')) {
                return NextResponse.redirect(`${origin}${next}`);
            }

            // THE BOUNCER LOGIC: Check Roles and Orphaned Users
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const { data: profile } = await supabase
                    .from('users')
                    .select('shop_id, role')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    const userRole = profile.role?.toUpperCase();

                    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
                        return NextResponse.redirect(`${origin}/admin`);
                    }

                    if (profile.shop_id && (userRole === 'OWNER' || userRole === 'STAFF')) {
                        return NextResponse.redirect(`${origin}${next}`);
                    }
                }

                await supabase.auth.signOut();
                return NextResponse.redirect(`${origin}/login?error=Unauthorized.%20Please%20register%20your%20pharmacy%20first.`);
            }
        } else {
            // --- NEW TRIPWIRE ---
            // If the code exchange fails, print the exact reason to the VS Code terminal
            console.error("\n❌ AUTH CALLBACK ERROR:", error.message, "\n");
        }
    } else {
        console.error("\n❌ AUTH CALLBACK ERROR: No 'code' found in the URL.\n");
    }

    // Fallback for expired codes or network errors
    return NextResponse.redirect(`${origin}/login?error=Authentication%20failed.%20Please%20try%20again.`);
}