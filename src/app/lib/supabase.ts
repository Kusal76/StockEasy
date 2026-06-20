import { createBrowserClient } from '@supabase/ssr'

// This creates a Supabase client that automatically syncs auth states to cookies!
export const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)