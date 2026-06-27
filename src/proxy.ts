import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({
        request: { headers: request.headers },
    })

    // 🚨 Extract the remember_me flag from the login header or transient cookie override
    const rememberMeCookie = request.cookies.get('stockeasy_remember_me')?.value;
    const isRemembered = rememberMeCookie !== 'false'; // Defaults to true if not explicitly false

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return request.cookies.get(name)?.value },
                set(name: string, value: string, options: CookieOptions) {
                    // 🚨 If the user unchecked "Remember Me", force cookies to be non-persistent session cookies
                    const modifiedOptions = !isRemembered
                        ? { ...options, maxAge: undefined, expires: undefined }
                        : { ...options, maxAge: 60 * 60 * 24 * 30 }; // Force explicit 30 days if checked

                    request.cookies.set({ name, value, ...modifiedOptions })
                    response = NextResponse.next({ request: { headers: request.headers } })
                    response.cookies.set({ name, value, ...modifiedOptions })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({ name, value: '', ...options })
                    response = NextResponse.next({ request: { headers: request.headers } })
                    response.cookies.set({ name, value: '', ...options })
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    const currentPath = request.nextUrl.pathname;

    // RULE 1: Block unauthorized access
    if (!user && (currentPath.startsWith('/dashboard') || currentPath.startsWith('/admin'))) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // RULE 2: If logged in, push away from public pages.
    if (user && (currentPath === '/login' || currentPath === '/register' || currentPath === '/')) {
        let role = "STAFF";

        const { data: platformData } = await supabase
            .from('platform_admins')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        if (platformData?.role) {
            role = platformData.role.toUpperCase();
        } else {
            const { data: userData } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
            if (userData?.role) role = userData.role.toUpperCase();
        }

        const targetDestination = (role === "ADMIN" || role === "SUPERADMIN") ? '/admin' : '/dashboard';
        return NextResponse.redirect(new URL(targetDestination, request.url))
    }

    return response
}

export const config = {
    matcher: ['/dashboard/:path*', '/admin/:path*', '/login', '/register', '/'],
}