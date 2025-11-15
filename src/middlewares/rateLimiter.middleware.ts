import { NextFunction, Request, Response } from "express";
import { getRedisConnectionObject } from "../config/redis.config";
import logger from "../config/logger.config";

class RateLimiter {
    private redis;
    private readonly windowMs: number;
    private readonly maxRequests: number;

    constructor(windowMs: number, maxRequest: number) {
        this.redis = getRedisConnectionObject();
        this.windowMs = windowMs; // 1 minute
        this.maxRequests = maxRequest; // 30 requests per minutes
    }

    /**
     * Rate limit by IP address
     */
    byIP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `rate_limit:ip:${ip}`;

        try {
            const current = await this.redis.incr(key);

            if(current == 1) {
                // First request in window, set expiry
                await this.redis.expire(key, Math.ceil(this.windowMs / 1000));
            }

            // Get TTL (time to live)
            const ttl = await this.redis.ttl(key);

            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
            res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - current).toString());
            res.setHeader('X-RateLimit-Reset', (Date.now() + ttl * 1000).toString());

            if(current > this.maxRequests) {
                res.status(429).json({
                    error: 'To many requests',
                    message: `Rate limit exceeded. Max ${this.maxRequests} requests per minute.`,
                    retryAfter: ttl
                });
                return;
            }

            next();
        } catch (error) {
            logger.error('Rate limiter error: ', error);
            next();
        }
    }

    /**
     * Rate limit by symbol
     */
    bySymbol = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const symbol = req.params.symbol;

        if(!symbol) {
            return next();
        }

        const key = `rate_limit:symbol:${symbol}`;
        const maxPerSymbol = 10;

        try {
            const current = await this.redis.incr(key);

            if(current == 1) {
                await this.redis.expire(key, 60);
            }

            if(current > maxPerSymbol) {
                res.status(429).json({
                    error: 'Too many requests for this symbol',
                    message: `Rate limit exceeded for symbol ${symbol}. Max ${maxPerSymbol} requests per minute.`,
                });
                return;
            }

            next();
        } catch (error) {
            logger.error('Symbol rate limit error: ', error);
            next();
        }
    }

    /**
     * Rate limiter to prevent the external API calls
     */
    async checkExternalApiLimit(apiName: 'Yahoo' | 'google'): Promise<boolean> {
        const key = `rate_limit:external:${apiName}`;
        const maxExternalCalls = 50; // Max 50 external API calls per minute

        try {
            const current = await this.redis.incr(key);

            if(current == 1) {
                await this.redis.expire(key, 60);
            }

            return current <= maxExternalCalls;
        } catch (error) {
            logger.error('External API rate limiter error: ', error);
            return true;
        }
    }

    /**
     * Rate limiter to prevent the external API calls
     */
    async throttle(key: string, delayMs: number = 1000): Promise<boolean> {
        try {
            const throttleKey = `throttle:${key}`;
            const exists = await this.redis.exists(throttleKey);

            if(exists) {
                return false;
            }

            // set the throttle with expiry
            await this.redis.setex(throttleKey, Math.ceil(delayMs / 1000), '1');
            return true;
        } catch (error) {
            logger.error('Throttle error: ', error);
            return true;
        }
    }
}

export const rateLimiter = new RateLimiter(60000, 30); // 30 requests per minute

export const rateLimiterByIP = rateLimiter.byIP;
export const rateLimiterBySymbol = rateLimiter.bySymbol;