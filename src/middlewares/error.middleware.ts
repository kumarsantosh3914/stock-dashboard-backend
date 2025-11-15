import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors/app.error";

export const appErrorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
    const statusCode = (err && (err as any).statusCode) || 500;
    const message = err && err.message ? err.message : "Internal Server Error";

    res.status(statusCode).json({
        success: false,
        message,
    });
}

export const genericErrorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
    const statusCode = (err && (err as any).statusCode) || 500;
    const message = err && err.message ? err.message : "Internal Server Error";

    res.status(statusCode).json({
        success: false,
        message,
    });
}