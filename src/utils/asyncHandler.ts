import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wrap an async route handler so thrown errors flow into Express's error pipeline.
 * Preserves return type so handlers can still send responses.
 */
export const asyncHandler =
  <P = Record<string, string>, ResBody = unknown, ReqBody = unknown, ReqQuery = Record<string, string>>(
    fn: (
      req: Request<P, ResBody, ReqBody, ReqQuery>,
      res: Response<ResBody>,
      next: NextFunction,
    ) => Promise<unknown>,
  ): RequestHandler<P, ResBody, ReqBody, ReqQuery> =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };