import type { Request, Response } from "express";
import Product from "../../models/product.js";
import Category from "../../models/category.js";
import SubCategory from "../../models/subCategory.js";
import SubSubCategory from "../../models/subSubCategory.js";
import Material from "../../models/material.js";
import cache from "../../lib/cache.js";
import { success, fail } from "../../utils/responses.js";
import { logger } from "../../lib/logger.js";

const PRODUCT_SELECT =
  "name slug images price image stock discount_price weight length height breadth purity sizes type sku tags videoUrl giftImages colors material category subCategory subSubCategory description shortDescription variants";

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
  options: { sort: { order: -1 } },
} as const;

const POPULATE_MATERIAL = {
  path: "material",
  select: "name",
  match: { deletedAt: null, status: true },
  options: { sort: { order: -1 } },
} as const;

const POPULATE_SIZES = {
  path: "sizes",
  select: "name",
  match: { deletedAt: null, status: true },
  options: { sort: { order: -1 } },
} as const;

const POPULATE_CATEGORY_GIFT = {
  path: "category",
  match: {
    name: { $regex: "gift items", $options: "i" },
    deletedAt: null,
    status: true,
  },
  select: "name slug",
} as const;

const POPULATE_SUBCATEGORY_GIFT = {
  path: "subCategory",
  match: {
    name: { $regex: "gift items", $options: "i" },
    deletedAt: null,
    status: true,
  },
  select: "name slug",
} as const;

const PRODUCT_POPULATE = [
  POPULATE_CATEGORY,
  POPULATE_SUBCATEGORY,
  POPULATE_SUBSUBCATEGORY,
  POPULATE_COLORS,
  POPULATE_MATERIAL,
  POPULATE_SIZES,
];


// ─── Search ranking helpers ──────────────────────────────────────────────
// Search candidates are fetched once (bounded) so getBySearch and
// getProductByFilter share the same relevance ranking.
const SEARCH_CANDIDATE_CAP = 200; // max candidate ids fetched for ranking
const SEARCH_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

const escapeRegex = (str: string): string =>
  str.replace(SEARCH_ESCAPE_RE, "\\$&");

/**
 * Build typo-tolerant word-start prefixes for a search word: the exact
 * first-4-letter prefix plus single-character deletion and adjacent
 * transposition variants. This lets misspellings inside the first letters
 * still match the real product word (e.g. "earing" → "ear", "rign" → "ring",
 * "chian" → "chai", "banlge" → "ban"). Used only by the regex fallback and
 * the JS scorer — never by the $text stage.
 */
function fuzzyPrefixes(word: string): string[] {
  const base = word.toLowerCase().slice(0, 4);
  const out = new Set<string>([base]);
  if (base.length >= 2) {
    // single-character deletion
    for (let i = 0; i < base.length; i++) {
      out.add(base.slice(0, i) + base.slice(i + 1));
    }
    // adjacent transposition
    for (let i = 0; i < base.length - 1; i++) {
      out.add(
        base.slice(0, i) + base.charAt(i + 1) + base.charAt(i) + base.slice(i + 2),
      );
    }
  }
  return [...out].filter((p) => p.length >= 2);
}

/**
 * Returns up to 'limit' product _ids ranked by relevance for 'searchWords'.
 * Two stages (deduplicated):
 *   1. Weighted MongoDB $text search (name:10, tags:5, shortDescription:3,
 *      description:1) — fast candidate discovery backed by the weighted index.
 *   2. Regex fallback for partial / misspelled terms ($text has no prefix or
 *      fuzzy support) — typo-tolerant word-boundary prefix matches against
 *      name / tags only (descriptions use different wording and add noise).
 * All candidates are then re-scored in JS (exact per-word > prefix, name >
 * tags > shortDescription) so multi-word queries rank products matching the
 * most terms first, regardless of raw textScore quirks. Only active products
 * are considered. 'extraFilters' are ANDed in.
 */
function relevanceScore(
  doc: { name?: unknown; tags?: unknown; shortDescription?: unknown },
  lowerWords: string[],
): number {
  const name = String(doc.name ?? "").toLowerCase();
  const shortDescription = String(doc.shortDescription ?? "").toLowerCase();
  const tags = (Array.isArray(doc.tags) ? doc.tags : []).map((tag) =>
    String(tag).toLowerCase(),
  );

  let score = 0;
  for (const word of lowerWords) {
    const inName = name.includes(word);
    const inTags = tags.some((tag) => tag.includes(word));
    const inShort = shortDescription.includes(word);

    if (inName) score += 120;
    else if (inTags) score += 60;
    else if (inShort) score += 30;

    const prefix = word.slice(0, Math.min(word.length, 4));
    if (prefix.length >= 2) {
      if (!inName && name.includes(prefix)) score += 70;
      else if (!inTags && tags.some((tag) => tag.includes(prefix))) score += 35;
      else if (!inShort && shortDescription.includes(prefix)) score += 15;
      else {
        // Typo tolerance: none of the exact-prefix checks matched — accept a
        // fuzzy prefix variant (single deletion / transposition of the first
        // 4 letters) so "earing"→"ear", "rign"→"ring", "chian"→"chai" work.
        for (const variant of fuzzyPrefixes(word)) {
          const variantRe = new RegExp("\\b" + escapeRegex(variant), "i");
          if (variantRe.test(name)) { score += 40; break; }
          if (tags.some((tag) => variantRe.test(String(tag)))) { score += 20; break; }
        }
      }
    }
  }
  // Slight bonus for the final search word matching the name — it is often
  // the category term (e.g. 'earrings' in 'gold earrings'), which surfaces
  // the intended product type above equal-weight competitors.
  if (lowerWords.length > 1) {
    const lastWord = lowerWords[lowerWords.length - 1] as string;
    if (lastWord.length > 1 && name.includes(lastWord)) score += 30;
  }

  return score;
}

async function searchProductCandidates(
  searchWords: string[],
  limit: number,
  extraFilters: Record<string, unknown> = {},
): Promise<string[]> {
  const baseFilter: Record<string, unknown> = {
    deletedAt: null,
    status: "active",
    ...extraFilters,
  };
  const lowerWords = searchWords.map((word) => word.toLowerCase());
  const scored = new Map<string, number>();
  const CANDIDATE_SELECT = "name tags shortDescription";

  // Stage 1 — weighted $text (fast, index-backed candidate discovery)
  if (searchWords.length > 0) {
    const textLimit = Math.min(Math.max(limit * 6, 40), 400);
    const textResults = await Product.find(
      { $text: { $search: searchWords.join(" ") }, ...baseFilter },
      // 'score' ($meta textScore) is never read in JS but MUST stay in the
      // projection — MongoDB requires it to allow the .sort({ score: meta })
      // above. Candidates are re-ranked later by relevanceScore().
      { _id: 1, name: 1, tags: 1, shortDescription: 1, score: { $meta: "textScore" } },
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(textLimit)
      .lean();

    for (const doc of textResults) {
      const score = relevanceScore(doc, lowerWords);
      if (score > 0) scored.set(String(doc._id), score);
    }
  }

  // Stage 2 — partial/fuzzy regex fallback (only when $text under-delivers)
  if (scored.size < Math.max(limit * 2, 10)) {
    // Fuzzy fallback searches ONLY title data (name + tags) — descriptions
    // use different wording and only add noise to typo matching.
    const prefixVariants = new Set<string>();
    for (const word of searchWords) {
      for (const variant of fuzzyPrefixes(word)) prefixVariants.add(variant);
    }

    if (prefixVariants.size > 0) {
      const regexes = [...prefixVariants].map(
        (prefix) => new RegExp("\\b" + escapeRegex(prefix), "i"),
      );
      const regexFilter: Record<string, unknown> = {
        $or: [
          { name: { $in: regexes } },
          { tags: { $in: regexes } },
        ],
        ...baseFilter,
      };

      const regexResults = await Product.find(regexFilter)
        .select(CANDIDATE_SELECT)
        .limit(Math.min(limit * 8, 400))
        .lean();

      for (const doc of regexResults) {
        const id = String(doc._id);
        if (scored.has(id)) continue;
        const score = relevanceScore(doc, lowerWords);
        if (score > 0) scored.set(id, score);
      }
    }
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

export const getOne = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { slug } = req.params;
    const product = await Product.findOne({
      slug,
      status: "active",
      deletedAt: null,
    })
      .select("-__v -deletedAt")
      .populate(PRODUCT_POPULATE)
      .lean();

    if (!product) throw new Error("Product not found");

    return success(res, product, "Product fetched successfully");
  } catch (err) {
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
    );
  }
};

export const getByCategory = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { categorySlug, subCategorySlug, subSubCategorySlug } = req.params;
    const {
      page = "1",
      limit = "20",
      sort = { order: -1, createdAt: -1 },
    } = req.query as {
      page?: string;
      limit?: string;
      sort?: Record<string, 1 | -1>;
    };

    const cappedLimit = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * cappedLimit;

    const [category, subCategory, subSubCategory] = await Promise.all([
      categorySlug
        ? Category.findOne({ slug: categorySlug }).select("_id").lean()
        : Promise.resolve(null),
      subCategorySlug
        ? SubCategory.findOne({ slug: subCategorySlug }).select("_id").lean()
        : Promise.resolve(null),
      subSubCategorySlug
        ? SubSubCategory.findOne({ slug: subSubCategorySlug }).select("_id").lean()
        : Promise.resolve(null),
    ]);

    const filters: Record<string, unknown>[] = [];
    if (category) filters.push({ category: { $in: [category._id] } });
    if (subCategory)
      filters.push({ subCategory: { $in: [subCategory._id] } });
    if (subSubCategory)
      filters.push({ subSubCategory: { $in: [subSubCategory._id] } });

    if (filters.length === 0) {
      return success(res, [], "No Products Found", 200, {
        _pagination: { total: 0, page: 1, limit: 0, totalPages: 0 },
      });
    }

    const query = { $or: filters, deletedAt: null, status: "active" };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate(POPULATE_CATEGORY)
        .populate(POPULATE_SUBCATEGORY)
        .populate(POPULATE_SUBSUBCATEGORY)
        .select(PRODUCT_SELECT)
        .sort(sort)
        .limit(cappedLimit)
        .skip(skip)
        .lean(),
      Product.countDocuments(query),
    ]);

    return success(res, products, "Products fetched successfully", 200, {
      _pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
      [],
    );
  }
};

export const getProductByFilter = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const q = req.query;

    const isFeatured = q.isFeatured === "true" ? true : undefined;
    const isNewArrival = q.isNewArrival === "true" ? true : undefined;
    const isBestSeller = q.isBestSeller === "true" ? true : undefined;
    const isTopRated = q.isTopRated === "true" ? true : undefined;
    const isUpsell = q.isUpsell === "true" ? true : undefined;
    const isOnSale = q.isOnSale === "true" ? true : undefined;

    const colorIds = typeof q.colorIds === "string" ? q.colorIds.split(",").filter(Boolean) : undefined;
    const materialIds = typeof q.materialIds === "string" ? q.materialIds.split(",").filter(Boolean) : undefined;

    const categorySlug = q.categorySlug as string | undefined;
    const subCategorySlug = q.subCategorySlug as string | undefined;
    const subSubCategorySlug = q.subSubCategorySlug as string | undefined;

    const priceFrom = q.priceFrom ? Number(q.priceFrom) : undefined;
    const priceTo = q.priceTo ? Number(q.priceTo) : undefined;
    const searchQuery = q.searchQuery as string | undefined;
    let searchWordList: string[] = [];
    const limit = q.limit ? Number(q.limit) : 20;
    const page = q.page ? Number(q.page) : 1;

    const query: Record<string, unknown> = { deletedAt: null, status: "active" };

    if (searchQuery && searchQuery.trim() !== "") {
      const trimmedSearch = searchQuery.trim();

      const genderKeywords = {
        men: ["men", "man", "mans", "mens"],
        women: ["women", "woman", "womans", "womens"],
      };
      const stopWords = new Set([
        "for", "the", "a", "an", "and", "or", "of", "to", "in", "on", "with",
        "him", "her", "is", "it", "by", "men", "women", "man", "mans", "mens",
        "womans", "womens", "woman",
      ]);
      const allSearchWords = trimmedSearch.split(/\s+/);

      const genderSubCategoryIds: string[] = [];
      for (const word of allSearchWords) {
        const lowerWord = word.toLowerCase();
        if (genderKeywords.men.includes(lowerWord)) {
          const cacheKey = "subCategory_men";
          if (cache.has(cacheKey)) {
            const cachedIds = cache.get<string[]>(cacheKey);
            if (cachedIds) genderSubCategoryIds.push(...cachedIds);
          } else {
            const menSubCategories = await SubCategory.find({
              name: { $regex: "\\bmens\\b", $options: "i" },
              status: true,
              deletedAt: null,
            })
              .select("_id")
              .lean();
            const ids = menSubCategories.map((sc) => String(sc._id));
            cache.set(cacheKey, ids);
            genderSubCategoryIds.push(...ids);
          }
        }
        if (genderKeywords.women.includes(lowerWord)) {
          const cacheKey = "subCategory_women";
          if (cache.has(cacheKey)) {
            const cachedIds = cache.get<string[]>(cacheKey);
            if (cachedIds) genderSubCategoryIds.push(...cachedIds);
          } else {
            const womenSubCategories = await SubCategory.find({
              name: { $regex: "\\bwomens\\b", $options: "i" },
              status: true,
              deletedAt: null,
            })
              .select("_id")
              .lean();
            const ids = womenSubCategories.map((sc) => String(sc._id));
            cache.set(cacheKey, ids);
            genderSubCategoryIds.push(...ids);
          }
        }
      }

      if (genderSubCategoryIds.length > 0) {
        query.subCategory = { $in: genderSubCategoryIds };
      }

      const searchWords = allSearchWords.filter(
        (word) => word.length > 1 && !stopWords.has(word.toLowerCase()),
      );
      const effectiveSearchWords =
        searchWords.length > 0 ? searchWords : [trimmedSearch];

      searchWordList = effectiveSearchWords;
    }

    if (isFeatured !== undefined) query.isFeatured = isFeatured;
    if (isNewArrival !== undefined) query.isNewArrival = isNewArrival;
    if (isBestSeller !== undefined) query.isBestSeller = isBestSeller;
    if (isTopRated !== undefined) query.isTopRated = isTopRated;
    if (isUpsell !== undefined) query.isUpsell = isUpsell;
    if (isOnSale !== undefined) query.isOnSale = isOnSale;

    if (categorySlug || subCategorySlug || subSubCategorySlug) {
      const [cats, subCats, subSubCats] = await Promise.all([
        categorySlug
          ? Category.find({
              slug: Array.isArray(categorySlug)
                ? { $in: categorySlug }
                : categorySlug,
            })
              .select("_id")
              .lean()
          : Promise.resolve([]),
        subCategorySlug
          ? SubCategory.find({
              slug: Array.isArray(subCategorySlug)
                ? { $in: subCategorySlug }
                : subCategorySlug,
            })
              .select("_id")
              .lean()
          : Promise.resolve([]),
        subSubCategorySlug
          ? SubSubCategory.find({
              slug: Array.isArray(subSubCategorySlug)
                ? { $in: subSubCategorySlug }
                : subSubCategorySlug,
            })
              .select("_id")
              .lean()
          : Promise.resolve([]),
      ]);
      if (cats.length > 0) {
        query.category = { $in: cats.map((c) => c._id) };
      }
      if (subCats.length > 0) {
        query.subCategory = { $in: subCats.map((c) => c._id) };
      }
      if (subSubCats.length > 0) {
        query.subSubCategory = { $in: subSubCats.map((c) => c._id) };
      }
    }
    if (colorIds && colorIds.length > 0) query.colors = { $in: colorIds };
    if (materialIds && materialIds.length > 0) {
      query.material = { $in: materialIds };
    }
    if (priceFrom !== undefined && priceTo !== undefined) {
      query.discount_price = {
        $gte: Number(priceFrom),
        $lte: Number(priceTo),
      };
    } else if (priceFrom !== undefined) {
      query.discount_price = { $gte: Number(priceFrom) };
    } else if (priceTo !== undefined) {
      query.discount_price = { $lte: Number(priceTo) };
    }

    const cappedLimit = Math.min(Number(limit), 100);
    const skip = Math.max(0, (Number(page) - 1) * cappedLimit);

    // Relevance-ranked search path: candidates come from the weighted $text
    // search plus a partial/fuzzy regex fallback (searchProductCandidates),
    // then the remaining filters apply on top. Ordering follows candidate rank.
    if (searchWordList.length > 0) {
      const candidateIds = await searchProductCandidates(
        searchWordList,
        SEARCH_CANDIDATE_CAP,
        query, // respect category/price/color/material filters during discovery
      );

      if (candidateIds.length === 0) {
        return success(res, [], "Products Found", 200, {
          _pagination: {
            total: 0,
            page: Number(page),
            limit: cappedLimit,
            totalPages: 0,
          },
        });
      }

      const filteredQuery: Record<string, unknown> = {
        ...query,
        _id: { $in: candidateIds },
      };

      const [total, docs] = await Promise.all([
        Product.countDocuments(filteredQuery),
        Product.find(filteredQuery)
          .populate(PRODUCT_POPULATE)
          .select(PRODUCT_SELECT)
          .lean(),
      ]);

      const idOrder = new Map(
        candidateIds.map((id, index): [string, number] => [id, index]),
      );
      const ordered = docs
        .slice()
        .sort(
          (a, b) =>
            (idOrder.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER) -
            (idOrder.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER),
        );
      const pageItems = ordered.slice(skip, skip + cappedLimit);

      return success(res, pageItems, "Products Found", 200, {
        _pagination: {
          total,
          page: Number(page),
          limit: cappedLimit,
          totalPages: Math.ceil(total / cappedLimit),
        },
      });
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .populate(PRODUCT_POPULATE)
        .select(PRODUCT_SELECT)
        .limit(cappedLimit)
        .skip(skip)
        .sort({ order: -1, createdAt: -1 })
        .lean(),
    ]);

    return success(res, products, "Products Found", 200, {
      _pagination: {
        total,
        page: Number(page),
        limit: cappedLimit,
        totalPages: Math.ceil(total / cappedLimit),
      },
    });
  } catch (err) {
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
      [],
    );
  }
};

export const getAll = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const products = await Product.find({ deletedAt: null, status: "active" })
      .populate(PRODUCT_POPULATE)
      .select(PRODUCT_SELECT)
      .sort({ order: -1, createdAt: -1 })
      .lean();
    return success(res, products, "Products fetched successfully");
  } catch (err) {
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
      [],
    );
  }
};

export const relatedProducts = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const subCategoryIdsRaw = typeof req.query.subCategoryIds === "string" ? (req.query.subCategoryIds as string).split(",").filter(Boolean) : undefined;
    const subCategoryIds = subCategoryIdsRaw?.slice(0, 20);
    const subSubCategoryIdsRaw = typeof req.query.subSubCategoryIds === "string" ? (req.query.subSubCategoryIds as string).split(",").filter(Boolean) : undefined;
    const subSubCategoryIds = subSubCategoryIdsRaw?.slice(0, 20);

    let products: Array<Record<string, unknown>> = [];

    if (subSubCategoryIds && subSubCategoryIds.length > 0) {
      products = await Product.find({
        deletedAt: null,
        status: "active",
        subSubCategory: { $in: subSubCategoryIds },
      })
        .limit(10)
        .populate(PRODUCT_POPULATE)
        .select(PRODUCT_SELECT)
        .sort({ order: -1, createdAt: -1 })
        .lean();
    }

    if (
      products.length < 10 &&
      subCategoryIds &&
      subCategoryIds.length > 0
    ) {
      const remainingLimit = 10 - products.length;
      const existingProductIds = (
        products
      ).map((p) => p._id);

      const subCategoryProducts = await Product.find({
        subCategory: { $in: subCategoryIds },
        _id: { $nin: existingProductIds },
      })
        .limit(remainingLimit)
        .populate(PRODUCT_POPULATE)
        .select(PRODUCT_SELECT)
        .lean();

      products.push(...subCategoryProducts);
    }

    return success(res, products, "Related products fetched successfully");
  } catch (err) {
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
      [],
    );
  }
};

const fetchFeaturedList = async (filter: Record<string, unknown>, limit: number) => {
  filter.deletedAt = null;
  filter.status = "active";
  return Product.find(filter)
    .populate(PRODUCT_POPULATE)
    .select(PRODUCT_SELECT)
    .sort({ order: -1, createdAt: -1 })
    .limit(limit)
    .lean();
};

export const newArrivals = async (
  _req: Request,
  res: Response,
): Promise<Response> => {
  try {
    if (cache.has("newArrivals")) {
      return success(res, cache.get("newArrivals"), "Products fetched successfully");
    }
    const products = await fetchFeaturedList({ isNewArrival: true }, 20);
    cache.set("newArrivals", products);
    return success(res, products, "Products fetched successfully");
  } catch (err) {
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
      [],
    );
  }
};

export const trendingProducts = async (
  _req: Request,
  res: Response,
): Promise<Response> => {
  try {
    if (cache.has("trendingProducts")) {
      return success(res, cache.get("trendingProducts"), "Products fetched successfully");
    }
    const products = await fetchFeaturedList({ isUpsell: true }, 20);
    cache.set("trendingProducts", products);
    return success(res, products, "Products fetched successfully");
  } catch (err) {
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
      [],
    );
  }
};

export const bestSellers = async (
  _req: Request,
  res: Response,
): Promise<Response> => {
  try {
    if (cache.has("bestSellers")) {
      return success(res, cache.get("bestSellers"), "Products fetched successfully");
    }
    const products = await fetchFeaturedList({ isBestSeller: true }, 20);
    cache.set("bestSellers", products);
    return success(res, products, "Products fetched successfully");
  } catch (err) {
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
      [],
    );
  }
};

export const featuredForFooter = async (
  _req: Request,
  res: Response,
): Promise<Response> => {
  try {
    if (cache.has("featuredForFooter")) {
      return success(res, cache.get("featuredForFooter"), "Products fetched successfully");
    }
    const products = await Product.find({
      isFeatured: true,
      deletedAt: null,
      status: "active",
    })
      .populate("category", "name slug")
      .populate("subCategory", "name slug")
      .populate("subSubCategory", "name slug")
      .populate(POPULATE_COLORS)
      .populate(POPULATE_MATERIAL)
      .select(
        "name slug images price image stock discount_price colors material category subCategory subSubCategory",
      )
      .sort({ order: -1, createdAt: -1 })
      .limit(2)
      .lean();

    cache.set("featuredForFooter", products);
    return success(res, products, "Products fetched successfully");
  } catch (err) {
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
      [],
    );
  }
};

export const tabProducts = async (
  _req: Request,
  res: Response,
): Promise<Response> => {
  try {
    if (cache.has("tabProducts")) {
      return success(
        res,
        cache.get("tabProducts"),
        "Tab products fetched successfully",
      );
    }
    // Collect ALL gold/silver-family materials (e.g. "Gold", "Pure Gold",
    // "Rough Gold") instead of a single findOne — findOne with a loose regex
    // returns the first natural-order match (e.g. "Pure Gold") which may have
    // no products, leaving the gold/silver tabs empty.
    const [goldMats, silverMats] = await Promise.all([
      Material.find({
        name: { $regex: "gold", $options: "i" },
        status: true,
        deletedAt: null,
      }).select("_id"),
      Material.find({
        name: { $regex: "silver", $options: "i" },
        status: true,
        deletedAt: null,
      }).select("_id"),
    ]);

    if (goldMats.length === 0 || silverMats.length === 0) {
      throw new Error("Gold or silver material not found");
    }

    const goldMatIds = goldMats.map((m) => m._id);
    const silverMatIds = silverMats.map((m) => m._id);

    const [goldProducts, silverProducts, giftProducts] = await Promise.all([
      Product.find({
        deletedAt: null,
        status: "active",
        material: { $in: goldMatIds },
      })
        .populate(POPULATE_MATERIAL)
        .populate(POPULATE_CATEGORY)
        .populate(POPULATE_SUBCATEGORY)
        .populate(POPULATE_SUBSUBCATEGORY)
        .populate(POPULATE_COLORS)
        .select(PRODUCT_SELECT)
        .sort({ order: -1, createdAt: -1 })
        .limit(4)
        .lean(),

      Product.find({
        deletedAt: null,
        status: "active",
        material: { $in: silverMatIds },
      })
        .populate(POPULATE_MATERIAL)
        .populate(POPULATE_CATEGORY)
        .populate(POPULATE_SUBCATEGORY)
        .populate(POPULATE_SUBSUBCATEGORY)
        .populate(POPULATE_COLORS)
        .sort({ order: -1, createdAt: -1 })
        .limit(4)
        .lean(),

      Product.find({ deletedAt: null, status: "active", isGift: true })
        .populate(POPULATE_CATEGORY_GIFT)
        .populate(POPULATE_SUBCATEGORY_GIFT)
        .populate(POPULATE_SUBSUBCATEGORY)
        .populate(POPULATE_COLORS)
        .populate(POPULATE_MATERIAL)
        .sort({ order: -1, createdAt: -1 })
        .limit(4)
        .lean(),
    ]);

    // material is an array (ObjectId[]) in the schema, filter by non-empty array
    const goldFiltered = goldProducts.filter((p) => p.material && p.material.length > 0);
    const silverFiltered = silverProducts.filter((p) => p.material && p.material.length > 0);
    // category is also an array (ObjectId[]), filter by non-empty array
    const giftFiltered = giftProducts.filter((p) => p.category && p.category.length > 0);

    const data = { gold: goldFiltered, silver: silverFiltered, gift: giftFiltered };
    cache.set("tabProducts", data);

    return success(res, data, "Tab products fetched successfully");
  } catch (err) {
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
      { gold: [], silver: [], gift: [] },
    );
  }
};

/**
 * POST /api/website/product/batch
 * Accepts { ids: string[] } and returns matching products.
 * Useful for guest cart/wishlist — fetch multiple products in one request.
 */
export const getByIds = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { ids } = req.body as { ids?: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return success(res, [], "No product IDs provided");
    }

    // Cap to 50 IDs to prevent abuse
    const cappedIds = ids.slice(0, 50);

    const products = await Product.find({
      _id: { $in: cappedIds },
      deletedAt: null,
      status: "active",
    })
      .populate(PRODUCT_POPULATE)
      .select(PRODUCT_SELECT)
      .lean();

    return success(res, products, "Products fetched successfully");
  } catch (err) {
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
      [],
    );
  }
};

export const getBySearch = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { search, limit = "20" } = req.query as {
      search?: string;
      limit?: string;
    };
    const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);

    if (!search || search.trim() === "") {
      return success(res, [], "Search term is required");
    }

    const trimmedSearch = search.trim();
    // Remove very short tokens and common stop words so $text sees cleaner input
    const stopWords = new Set([
      "for", "the", "a", "an", "and", "or", "of", "to", "in", "on", "with",
      "him", "her", "is", "it", "by",
    ]);
    const cleanWords = trimmedSearch
      .split(/\s+/)
      .filter((word) => word.length > 1 && !stopWords.has(word.toLowerCase()));

    const searchWords = cleanWords.length > 0 ? cleanWords : [trimmedSearch];

    const ids = await searchProductCandidates(searchWords, parsedLimit);
    if (ids.length === 0) {
      return success(res, [], "Products fetched successfully");
    }

    const idOrder = new Map(
      ids.map((id, index): [string, number] => [id, index]),
    );
    const products = await Product.find({
      _id: { $in: ids },
      deletedAt: null,
      status: "active",
    })
      .populate(PRODUCT_POPULATE)
      .select(PRODUCT_SELECT)
      .lean();

    const ordered = products
      .map((p) => ({
        product: p,
        order: idOrder.get(String(p._id)) ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a.order - b.order)
      .map(({ product }) => product);

    return success(res, ordered, "Products fetched successfully");
  } catch (err) {
    logger.error({ err }, "Search error");
    return fail(
      res,
      err instanceof Error ? err.message : "Something went wrong",
      500,
      [],
    );
  }
};