import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { redis } from '@/app/lib/redis';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const shopId = searchParams.get('shopId');
        const query = searchParams.get('q')?.toLowerCase().trim() || '';

        if (!shopId) return NextResponse.json({ error: 'Missing shopId' }, { status: 400 });

        const cacheKey = `inventory:shop:${shopId}`;

        // 1. REDIS CACHE HIT
        let inventory: any[] | null = await redis.get(cacheKey);

        // 2. REDIS CACHE MISS -> Fetch from Supabase and store in Redis
        if (!inventory) {
            const { data, error } = await supabaseAdmin
                .from('inventory')
                .select('id, medicine_name, generic_name, batch_number, quantity, mrp, expiry_date')
                .eq('shop_id', shopId)
                .gt('quantity', 0)
                .order('expiry_date', { ascending: true }); // Pre-sort by expiry

            if (error) throw error;
            inventory = data || [];

            // Cache for 24 hours. (When you build your 'Add Stock' page, 
            // you will simply delete this key to force a refresh).
            await redis.setex(cacheKey, 86400, inventory);
        }

        // 3. IN-MEMORY FILTERING (Lightning Fast)
        let results = inventory;
        if (query.length >= 2) {
            results = inventory.filter(item =>
                item.medicine_name.toLowerCase().includes(query) ||
                (item.generic_name && item.generic_name.toLowerCase().includes(query))
            );
        }

        // 4. FEFO LOGIC (Moved to server for better performance)
        const recommended = new Set<string>();
        const seenCompositions = new Set<string>();

        results.forEach(item => {
            const groupKey = item.generic_name ? item.generic_name.toLowerCase().trim() : item.medicine_name.toLowerCase().trim();
            if (!seenCompositions.has(groupKey)) {
                recommended.add(item.id);
                seenCompositions.add(groupKey);
            }
        });

        results.sort((a, b) => {
            const aRec = recommended.has(a.id);
            const bRec = recommended.has(b.id);
            if (aRec && !bRec) return -1;
            if (!aRec && bRec) return 1;
            return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
        });

        // Return top 20 results to keep the network payload tiny
        return NextResponse.json({
            results: results.slice(0, 20),
            recommendedIds: Array.from(recommended)
        });

    } catch (error: any) {
        console.error("Redis Search API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}