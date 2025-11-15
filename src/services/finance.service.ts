import YahooFinance from 'yahoo-finance2';
import { BadRequestError, InternalServerError } from "../utils/errors/app.error";
import logger from '../config/logger.config';
import { redisCacheService } from './cache.service';
import { rateLimiter } from '../middlewares/rateLimiter.middleware';

class YahooFinanceService {
    private normalizeToNSE(symbol: string): string {
        const s = symbol.trim().toUpperCase().replace(/\.(NS|NSE|BSE|BO|NFO)$/i, '');
        return `${s}.NS`;
    }

    private yf = new YahooFinance();

    private async fetchFromChartAPI(ticker: string): Promise<number | null> {
        const chart = await this.yf.chart(ticker, { range: '1d', interval: '1m' } as any);
        const meta = (chart as any)?.meta;
        const price = meta?.regularMarketPrice ?? meta?.previousClose;
        return typeof price === 'number' ? price : null;
    }

    async fetchPrice(symbol: string): Promise<number> {
        try {
            const ticker = this.normalizeToNSE(symbol);

            logger.info(`Fetching price for: ${ticker}`);

            // step 1: check redis cache first
            const response = await redisCacheService.getCachePrice(ticker);

            if (response) {
                return response.price;
            }

            // step 2: check external api rate limit
            const canProcess = await rateLimiter.checkExternalApiLimit('Yahoo');

            if (!canProcess) {
                logger.warn('Yahoo API rate limit exceeded.');
                throw new InternalServerError('External API rate limit exceeded. Please try again later.')
            }

            const canFetch = await rateLimiter.throttle(`yahoo:${ticker}`, 500);

            if (!canFetch) {
                logger.warn(`Throttled: ${ticker}`);

                // return the stale response cache if available
                const staleResponse = await redisCacheService.getCachePrice(ticker);
                if (staleResponse) {
                    return staleResponse.price;
                }

                throw new BadRequestError('Please wait before fetching data again');
            }

            const quote: any = await this.yf.quote(ticker);

            const price = quote?.regularMarketPrice ?? quote?.postMarketPrice ?? quote?.preMarketPrice;
            if (typeof price !== 'number') {
                const chartPrice = await this.fetchFromChartAPI(ticker);
                if (typeof chartPrice === 'number') return chartPrice;
                throw new BadRequestError(`Price not found for ${symbol}`);
            }

            // cache the response
            await redisCacheService.cachePrice(ticker, price);

            return price;
        } catch (error: any) {
            if (error && error.statusCode) throw error;
            throw new InternalServerError(error?.message || `Failed to fetch price for ${symbol}`);
        }
    }

    async fetchMetrics(symbol: string): Promise<{ peRatio: string; latestEarnings: string }> {
        try {
            const ticker = this.normalizeToNSE(symbol);

            logger.info('Fetching metrics');

            // step 1: check data from redis cache first
            const response = await redisCacheService.getCacheMetrics(ticker);

            if (response) {
                return {
                    peRatio: response.peRatio,
                    latestEarnings: response.latestEarnings
                };
            }

            // step 2: check external api rate limit
            const canProcess = await rateLimiter.checkExternalApiLimit('Yahoo');

            if (!canProcess) {
                return {
                    peRatio: 'N/A',
                    latestEarnings: 'N/A'
                };
            }

            // step 3: throttle
            const canFetch = await rateLimiter.throttle(`yahoo:metrics:${ticker}`, 500);

            if (!canFetch) {
                const staleResponse = await redisCacheService.getCacheMetrics(ticker);
                if (staleResponse) {
                    return {
                        peRatio: staleResponse.peRatio,
                        latestEarnings: staleResponse.latestEarnings
                    };
                }

                return {
                    peRatio: 'N/A',
                    latestEarnings: 'N/A'
                }
            }

            const qs: any = await this.yf.quoteSummary(ticker, { modules: ['summaryDetail', 'defaultKeyStatistics', 'calendarEvents', 'price', 'financialData', 'earnings'] as any });

            const summary = qs?.summaryDetail || {};
            const stats = qs?.defaultKeyStatistics || {};
            const price = qs?.price || {};
            const cal = qs?.calendarEvents || {};
            const earnings = qs?.earnings || {};

            let trailingPE = summary?.trailingPE?.raw ?? stats?.trailingPE?.raw ?? price?.trailingPE?.raw;
            let forwardPE = summary?.forwardPE?.raw ?? stats?.forwardPE?.raw ?? price?.forwardPE?.raw;

            // Fallback to quote() if still missing
            if (typeof trailingPE !== 'number' && typeof forwardPE !== 'number') {
                const qt: any = await this.yf.quote(ticker);
                trailingPE = typeof qt?.trailingPE === 'number' ? qt.trailingPE : trailingPE;
                forwardPE = typeof qt?.forwardPE === 'number' ? qt.forwardPE : forwardPE;
            }

            // Earnings date from calendarEvents or earnings module
            let earningsDateArr = cal?.earnings?.earningsDate || [];
            let earningsDate = (earningsDateArr[0]?.fmt)
                || (earningsDateArr[0]?.raw ? new Date(earningsDateArr[0].raw * 1000).toISOString().slice(0, 10) : undefined);

            if (!earningsDate) {
                const nextEarnings = earnings?.earningsChart?.currentQuarterDate || earnings?.earningsChart?.currentQuarterEstimateDate;
                if (typeof nextEarnings === 'string') earningsDate = nextEarnings;
            }

            const result = {
                peRatio: typeof trailingPE === 'number' ? String(trailingPE) : (typeof forwardPE === 'number' ? String(forwardPE) : 'N/A'),
                latestEarnings: earningsDate || 'N/A'
            }

            // Cache the result
            await redisCacheService.cacheMetrics(ticker, result.peRatio, result.latestEarnings);

            return result;
        } catch (error: any) {
            if (error && error.statusCode) throw error;
            return {
                peRatio: 'N/A',
                latestEarnings: 'N/A'
            }
        }
    }
}

export const yahooFinanceService = new YahooFinanceService();