import Redis from "ioredis";
import { getRedisConnectionObject } from "../config/redis.config";
import logger from "../config/logger.config";
import { serverConfig } from "../config";

class RedisCacheService {
    private redis: Redis;
    private readonly DEFAULT_TTL = serverConfig.DEFAULT_TTL;
    private readonly PRICE_TTL = serverConfig.PRICE_TTL;
    private readonly METRICS_TTL = serverConfig.METRICS_TTL;

    constructor() {
        this.redis = getRedisConnectionObject();
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await this.redis.get(key);
            
            if(!data) {
                return null;
            }

            return JSON.parse(data) as T;
        } catch (error) {
            logger.error(`Redis error for key ${key}: `, error);
            return null;
        }
    }

    async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
        try {
            const ttl = ttlSeconds || this.DEFAULT_TTL;
            await this.redis.setex(key, ttl, JSON.stringify(value));
        } catch (error) {
            logger.error(`Redis error for key ${key}: `, error);
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.redis.del(key);
        } catch (error) {
            logger.error(`Redis error for key ${key}: `, error);
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const result = await this.redis.exists(key);
            return result == 1;
        } catch (error) {
            logger.error(`Redis error for key ${key}: `, error);
            return false;
        }
    }

    async ttl(key: string): Promise<number> {
        try {
            return await this.redis.ttl(key);
        } catch (error) {
            logger.error(`Redis error for key ${key}: `, error);
            return -1;
        }
    }

    async cachePrice(symbol: string, price: number): Promise<void> {
        const key = `price:${symbol}`;
        await this.set(key, {
            symbol,
            price
        },
        this.PRICE_TTL
        );
    }

    async getCachePrice(symbol: string): Promise<{ symbol: string; price: number; } | null> {
        const key = `price:${symbol}`;
        return await this.get<{ symbol: string; price: number }>(key);
    }

    async cacheMetrics(symbol: string, peRatio: string, latestEarning: string): Promise<void> {
        const key = `metrics:${symbol}`;
        await this.set(key, {
            symbol, 
            peRatio,
            latestEarning
        },
        this.METRICS_TTL
        );
    }

    async getCacheMetrics(symbol: string): Promise<{
        symbol: string;
        peRatio: string;
        latestEarnings: string;
    } | null> {
        const key = `metrics:${symbol}`;
        return await this.get(key);
    }

    async deleteAll(): Promise<void> {
        try {
            await this.redis.flushdb();
        } catch (error) {
            logger.error(`Redis FLUSHDB error: `, error);
        }
    }
}

export const redisCacheService = new RedisCacheService();