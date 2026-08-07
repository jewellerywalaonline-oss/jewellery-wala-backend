import type { Request, Response } from "express";
import productFaq from "../../models/productFaq.js";
import cache from "../../lib/cache.js";
import { success, fail } from "../../utils/responses.js";

export const productFaqController = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const productId = req.query.product as string | undefined;
    const cacheKey = "productFaqs";

    const cached = cache.get(cacheKey);
    if (cached) {
      const data = (cached as Array<Record<string, unknown>>).filter((item) => {
        const products = item.products as Array<unknown>;
        return productId
          ? products?.some((p) => String(p) === productId)
          : true;
      });
      return success(res, data, "Product FAQs fetched successfully");
    }

    const query: Record<string, unknown> = { deletedAt: null, status: true };
    const data = await productFaq.find(query).sort({ createdAt: -1 }).select("-__v -deletedAt").lean();

    cache.set(cacheKey, data, 600); // 10 min — FAQ data rarely changes

    const filtered = productId
      ? (data as Array<Record<string, unknown>>).filter((item) => {
          const products = item.products as Array<unknown>;
          return products?.some((p) => String(p) === productId);
        })
      : data;

    return success(res, filtered, "Product FAQs fetched successfully");
  } catch (error) {
    return fail(res, "Server error", 500);
  }
};
