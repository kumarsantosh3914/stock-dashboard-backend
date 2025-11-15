import express from 'express';
import { getStockMetrics, getStockPrice, getBatchStocks, getExcelData } from '../../controllers/stock.controller';
import { rateLimiterByIP, rateLimiterBySymbol } from '../../middlewares/rateLimiter.middleware';

const stockRouter = express.Router();

stockRouter.get('/portfolio', getExcelData);
stockRouter.get('/:symbol/price', rateLimiterByIP, rateLimiterBySymbol, getStockPrice);
stockRouter.get('/:symbol/metrics', rateLimiterByIP, rateLimiterBySymbol, getStockMetrics);
stockRouter.post('/batch', rateLimiterByIP, getBatchStocks);

export default stockRouter;