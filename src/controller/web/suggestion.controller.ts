import type { Request, Response } from "express";
import Product from "../../models/product.js";
import { success, fail } from "../../utils/responses.js";
import { logger } from "../../lib/logger.js";

const POPULATE_CATEGORY = {
  path: "category",
  select: "name slug",
  match: { deletedAt: null, status: true },
} as const;

const POPULATE_SUBCATEGORY = {
  path: "subCategory",
  select: "name slug",
  match: { deletedAt: null, status: true },
} as const;

const POPULATE_SUBSUBCATEGORY = {
  path: "subSubCategory",
  select: "name slug",
  match: { deletedAt: null, status: true },
} as const;

const POPULATE_COLORS = {
  path: "colors",
  select: "name code",
  match: { deletedAt: null, status: true },
} as const;

const POPULATE_MATERIAL = {
  path: "material",
  select: "name",
  match: { deletedAt: null, status: true },
} as const;

const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const STOP_WORDS = new Set([
  "for",
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "with",
  "him",
  "her",
  "is",
  "it",
  "by",
]);

export const getSearchWithSuggestions = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { search, limit = "6" } = req.query as {
      search?: string;
      limit?: string;
    };
    const parsedLimit = Math.min(parseInt(limit, 10) || 6, 50);

    if (!search || search.trim() === "") {
      return success(
        res,
        { suggestions: [], products: [] },
        "Search term is required",
      );
    }

    const trimmedSearch = search.trim();

    const searchWords = trimmedSearch
      .split(/\s+/)
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word.toLowerCase()))
      .map((word) => escapeRegex(word));

    const effectiveSearchWords =
      searchWords.length > 0 ? searchWords : [escapeRegex(trimmedSearch)];

    const regexPatterns = effectiveSearchWords.map((word) => [
      { name: { $regex: word, $options: "i" } },
      { slug: { $regex: word, $options: "i" } },
      { tags: { $regex: word, $options: "i" } },
    ]);

    const productQuery = {
      $and: [
        { $or: regexPatterns.flatMap((p) => p) },
        { deletedAt: null },
        { status: "active" },
      ],
    };

    const products = await Product.find(productQuery)
      .populate(POPULATE_CATEGORY)
      .populate(POPULATE_SUBCATEGORY)
      .populate(POPULATE_SUBSUBCATEGORY)
      .populate(POPULATE_COLORS)
      .populate(POPULATE_MATERIAL)
      .select(
        "name slug images price image stock discount_price colors material category subCategory subSubCategory",
      )
      .sort({ order: -1, createdAt: -1 })
      .limit(parsedLimit)
      .lean();

    const suggestionQuery = {
      $and: [
        { $or: regexPatterns.flatMap((p) => p) },
        { deletedAt: null },
        { status: "active" },
      ],
    };

    const suggestionProducts = await Product.find(suggestionQuery)
      .select("name")
      .sort({ order: -1, createdAt: -1 })
      .limit(20)
      .lean();

    const suggestions = suggestionProducts
      .map((p) => p.name)
      .filter((name, idx, arr): name is string => arr.indexOf(name) === idx)
      .map((name) => {
        let score = 0;
        const lowerName = name.toLowerCase();
        effectiveSearchWords.forEach((word) => {
          const lowerWord = word.toLowerCase();
          if (lowerName.startsWith(lowerWord)) score += 100;
          else if (lowerName.includes(lowerWord)) score += 50;
        });
        score += Math.max(0, 50 - name.length);
        return { name, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((item) => item.name);

    return success(
      res,
      {
        suggestions,
        products,
        searchTerm: trimmedSearch,
      },
      products.length > 0
        ? "Search results fetched successfully"
        : "No products found",
    );
  } catch (err) {
    logger.error({ err }, "Search error");
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
      { suggestions: [], products: [] },
    );
  }
};