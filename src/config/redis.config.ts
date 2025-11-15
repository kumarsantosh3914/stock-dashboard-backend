import Redis from "ioredis";
import { serverConfig } from ".";
import logger from "./logger.config";

// Singleton pattern to connect Redis
export function connectToRedis() {
    try {
        let connection: Redis;

        const redisConfig = {
            port: serverConfig.REDIS_PORT,
            host: serverConfig.REDIS_HOST,
            maxRetriesPerRequest: null, // Disable automatic retries
        };

        return () => {
            if(!connection) {
                connection = new Redis(redisConfig);
                return connection;
            }

            return connection;
        }
    } catch (error) {
        logger.error("Error connecting to Redis: ", error);
        throw error;
    }
}

export const getRedisConnectionObject = connectToRedis();