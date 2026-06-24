import { NextResponse } from 'next/server';
import { redis } from '@/app/lib/redis';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const shopId = searchParams.get('shopId');

        if (!shopId) {
            return NextResponse.json({ isBlacklisted: false });
        }

        // Check if the shop exists in the Redis blacklist
        const isSuspended = await redis.get(`blacklist:shop:${shopId}`);

        return NextResponse.json({ isBlacklisted: !!isSuspended });
    } catch (error) {
        console.error("Redis Blacklist Check Error:", error);
        // We "fail open". If Redis blips, we return false so we don't accidentally lock out paying users.
        return NextResponse.json({ isBlacklisted: false });
    }
}