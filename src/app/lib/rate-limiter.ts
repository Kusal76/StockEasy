import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// Define the limits for different tiers (Requests per 10-second rolling window)
export const tierLimits = {
    // Starter: 10 requests every 10 seconds (Basic usage)
    STARTER: new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(10, "10 s"),
        analytics: true,
    }),

    // Growth: 50 requests every 10 seconds (Medium volume)
    GROWTH: new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(50, "10 s"),
        analytics: true,
    }),

    // Pro: 200 requests every 10 seconds (High volume POS)
    PRO: new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(200, "10 s"),
        analytics: true,
    }),

    // Admin: 500 requests every 10 seconds (SuperAdmin dashboard operations)
    ADMIN: new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(500, "10 s"),
        analytics: true,
    }),
};