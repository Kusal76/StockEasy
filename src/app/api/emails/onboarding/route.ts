import { NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';

const qstash = new Client({
    token: process.env.QSTASH_TOKEN!,
    baseUrl: "https://qstash-us-east-1.upstash.io"
});

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';

        await qstash.publishJSON({
            url: `${appUrl}/api/webhooks/onboarding`,
            body: body,
            // THIS IS THE KEY: It tells LocalTunnel to let the bot through!
            headers: {
                "Upstash-Forward-Bypass-Tunnel-Reminder": "true"
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("QStash Publish Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}