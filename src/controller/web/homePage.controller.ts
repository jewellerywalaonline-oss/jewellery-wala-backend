import type { Request, Response } from "express";
import homePage from "../../models/homePage.js";
import cache from "../../lib/cache.js";
import { success, fail } from "../../utils/responses.js";

const CACHE_KEY = "homePage";

export const homePageController = async (
  _req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return success(res, cached, "Home page fetched");
    }

    const page = await homePage.findOne()
      .select("-createdAt -updatedAt -deletedAt")
      .lean();
    if (!page) {
      return success(res, { sections: [], version: 1 }, "Home page fetched");
    }

    cache.set(CACHE_KEY, page, 600); // 10 min — home page structure rarely changes
    return success(res, page, "Home page fetched");
  } catch (error) {
    return fail(
      res,
      "Server error",
      500,
    );
  }
};
