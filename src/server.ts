import express from 'express';
import { Express } from 'express';
import { serverConfig } from './config';
import v1Router from './routers/v1/index.router';
import { appErrorHandler, genericErrorHandler } from './middlewares/error.middleware';
import { attachCorrelationIdMiddleware } from './middlewares/correlation.middleware';
import logger from './config/logger.config';
import cors from 'cors';

const app: Express = express();

app.use(cors({
    origin: 'http://localhost:3001',
    credentials: true,
}));

// Middleware to parse JSON request bodies
app.use(express.json());

// Regestering all the routers and their corresponding routes with out app server object.
app.use(attachCorrelationIdMiddleware);

app.use('/api/v1', v1Router);

app.use(appErrorHandler);
// Middleware to handle errors
app.use(genericErrorHandler);

app.listen(serverConfig.PORT, async () => {
    logger.info(`Server is running on http://localhost:${serverConfig.PORT}`);
})