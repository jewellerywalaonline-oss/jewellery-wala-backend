/**
 * Generic cache-backed "list all active records" controllers.
 * Used by banner / faq / testimonial / color / material / whyChooseUs / logo / logo / nav / coupen.
 */
import type { Request, Response } from "express";
import type { Model } from "mongoose";
import cache from "../../lib/cache.js";
import { success, fail } from "../../utils/responses.js";

type AnyModel = Model<any>;

interface CacheListOptions {
  cacheKey: string;
  query?: Record<string, unknown>;
  /** Provide a custom data fetcher (e.g. for nav which joins multiple models). */
  fetcher?: (req: Request) => Promise<Record<string, unknown>[]>;
  message?: string;
  /** TTL in seconds. Defaults to NodeCache stdTTL (300s). */
  ttl?: number;
}

/**
 * Build an Express handler that returns a cached list of records.
 * If `fetcher` is provided, it overrides `query` and is responsible for the DB call.
 */
export const buildCacheListController =
  (model: AnyModel, options: CacheListOptions) =>
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const cached = cache.get(options.cacheKey);
      if (cached) {
        return success(
          res,
          cached,
          options.message ?? "Data fetched successfully",
        );
      }

      const data = options.fetcher
        ? await options.fetcher(req)
        : await model.find(options.query ?? { deletedAt: null, status: true }).select("-__v -deletedAt").lean();

      if (options.ttl != null) {
        cache.set(options.cacheKey, data, options.ttl);
      } else {
        cache.set(options.cacheKey, data);
      }
      return success(res, data, options.message ?? "Data fetched successfully");
    } catch (error) {
      return fail(
        res,
        "Server error",
        500,
      );
    }
  };