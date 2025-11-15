import express from 'express';
import pingRouter from './ping.router';
import stockRouter from './stock.rounter';

const v1Router = express.Router();

v1Router.use('/ping', pingRouter);
v1Router.use('/stocks', stockRouter);

export default v1Router;