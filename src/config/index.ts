// This file contains all the basic configuration for the app server to work
import dotenv from 'dotenv';

type ServerConfig = {
    PORT: number;
    REDIS_PORT?: number;
    REDIS_HOST?: string;
    DEFAULT_TTL: number;
    PRICE_TTL: number;
    METRICS_TTL: number;
}

function loadEnv() {
    dotenv.config();
    console.log('Environment variables loaded from .env file');
}

loadEnv();

export const serverConfig: ServerConfig = {
    PORT: Number(process.env.PORT) || 3000,
    REDIS_HOST: String(process.env.REDIS_HOST) || 'localhost',
    REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
    DEFAULT_TTL: Number(process.env.DEFAULT_TTL) || 15,
    PRICE_TTL: Number(process.env.PRICE_TTL) || 15,
    METRICS_TTL: Number(process.env.METRICS_TTL) || 15,
}