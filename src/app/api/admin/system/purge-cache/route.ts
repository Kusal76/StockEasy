import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
    try {
        // 1. In a production app, you would verify the user's admin role here.

        // 2. Clear Next.js server-side data & layout caches globally
        // Passing "/" with "layout" flushes the entire site cache tree
        revalidatePath('/', 'layout');

        return NextResponse.json({
            success: true,
            message: "System cache purged and revalidated successfully."
        });
    } catch (error: any) {
        console.error("❌ CACHE PURGE FAILED:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}