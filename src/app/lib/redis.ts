import { Redis } from '@upstash/redis';

// Initialize the Redis client using the environment variables
export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});