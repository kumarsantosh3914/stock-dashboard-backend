import { NextFunction, Request, Response } from "express";
import { yahooFinanceService } from "../services/finance.service";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { buildPortfolio } from "../services/portfolio.service";
import { redisCacheService } from "../services/cache.service";

export const getStockPrice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { symbol } = req.params;

        // Check data from redis cache first
        const response = await redisCacheService.getCachePrice(symbol);

        if(response) {
            res.json(response);
            return;
        }

        // If not available in the cache then fetch from yahoo finance
        const price = await yahooFinanceService.fetchPrice(symbol);

        const result = { symbol, price};

        // Cache the price in redis
        await redisCacheService.cachePrice(symbol, price);

        res.json(result);
    } catch (error) {
        next(error);
    }
}

export const getExcelData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filePath = path.resolve(__dirname, "../../data/A77E6A80.xlsx");

        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: "Excel file not found" });
            return;
        }

        const workbook = XLSX.readFile(filePath);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        let headerRowIndex = 0;
        let maxFilled = -1;
        rows.forEach((r, idx) => {
            const filled = r.filter((c) => c !== null && c !== '').length;
            if (filled > maxFilled) {
                maxFilled = filled;
                headerRowIndex = idx;
            }
        });

        const rawHeaders: string[] = (rows[headerRowIndex] || []).map((h) => (h == null ? '' : String(h)));

        const headers: string[] = [];
        const seen: Record<string, number> = {};
        for (let i = 0; i < rawHeaders.length; i++) {
            let name = rawHeaders[i]
                .replace(/[\r\n]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (!name) name = `col_${i + 1}`;
            const base = name;
            if (seen[base] == null) {
                seen[base] = 0;
                headers.push(base);
            } else {
                seen[base] += 1;
                headers.push(`${base}_${seen[base]}`);
            }
        }

        const data: Record<string, any>[] = [];
        for (let r = headerRowIndex + 1; r < rows.length; r++) {
            const row = rows[r] || [];
            const isEmpty = row.every((c) => c === null || c === '');
            if (isEmpty) continue;
            const obj: Record<string, any> = {};
            for (let c = 0; c < headers.length; c++) {
                obj[headers[c]] = c < row.length ? row[c] : null;
            }
            data.push(obj);
        }

        const portfolio = buildPortfolio(firstSheetName, data);
        res.json(portfolio);
    } catch (error) {
        next(error);
    }
}

export const getStockMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { symbol } = req.params;

        // Check data from redis cache first
        const response = await redisCacheService.getCacheMetrics(symbol);

        if(response) {
            res.json(response);
            return;
        }

        // If not available in the cache then fetch from yahoo finance
        const metrics = await yahooFinanceService.fetchMetrics(symbol);

        const result = {
            symbol,
            peRatio: metrics.peRatio,
            latestEarning: metrics.latestEarnings
        };

        // Cache the metrics in redis
        await redisCacheService.cacheMetrics(symbol, metrics.peRatio, metrics.latestEarnings);

        res.json(result);
    } catch (error) {
        throw error;
    }
}

export const getBatchStocks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { symbols } = req.body;

        if(!Array.isArray(symbols)) {
            res.status(400).json({
                err: 'Symbol must be an array'
            });
            return;
        }

        const results = await Promise.allSettled(
            symbols.map(async (symbol: string) => {
                let price: any = await redisCacheService.getCachePrice(symbol);

                if(!price) {
                    price = await yahooFinanceService.fetchPrice(symbol).catch(() => null);
                }

                const metrics = await yahooFinanceService.fetchMetrics(symbol).catch(() => ({ peRatio: 'N/A', latestEarnings: 'N/A' }));

                return {
                    symbol,
                    price, 
                    metrics
                };
            })
        );

        const data = results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return {
                    symbol: symbols[index],
                    error: 'Failed to fetch data',
                    price: null,
                    peRatio: 'N/A',
                    latestEarnings: 'N/A'
                }
            }
        });

        res.json(data);
    } catch (error) {
        next(error);
    }
}