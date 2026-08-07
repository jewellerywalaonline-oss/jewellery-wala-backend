import { z } from "zod";
import net from "node:net";
import FaqModel from "../../../models/faq.js";
import MaterialModel from "../../../models/material.js";
import ColorModel from "../../../models/color.js";
import ProductModel from "../../../models/product.js";
import CategoryModel from "../../../models/category.js";
import SubCategoryModel from "../../../models/subCategory.js";
import SubSubCategoryModel from "../../../models/subSubCategory.js";
import BannerModel from "../../../models/banner.js";
import TestimonialModel from "../../../models/testimonial.js";
import WhyChooseUsModel from "../../../models/whyChooseUs.js";
import CoupenModel from "../../../models/coupen.js";
import cache from "../../../lib/cache.js";
import { logger } from "../../../lib/logger.js";
import { isDuplicateError, escapeRegex, slugify, generateSlug } from "./helpers.js";
import {
  faqSchema,
  materialSchema,
  colorSchema,
  colorNameToHex,
  productDraftSchema,
  searchProductSchema,
  searchFaqSchema,
  createCategorySchema,
  createSubCategorySchema,
  createSubSubCategorySchema,
  updateProductSchema,
  createBannerSchema,
  createTestimonialSchema,
  createWhyChooseUsSchema,
  searchWhyChooseUsSchema,
  createCouponSchema,
  searchWebSchema,
  fetchUrlSchema,
} from "./schemas.js";

const CACHE_TTL = 600;
const CACHE_MISS = Symbol("cacheMiss");

export interface ToolDefinition {
  description: string;
  inputSchema: z.ZodSchema;
  execute: (args: Record<string, unknown>) => unknown;
}

function cachedQuery<T>(key: string, ttl: number, query: () => Promise<T>): Promise<T> {
  const cached = cache.get<T | typeof CACHE_MISS>(key);
  if (cached !== CACHE_MISS) return Promise.resolve(cached as T);
  return query().then((result) => { cache.set(key, result, ttl); return result; });
}

function lookupFilter(query?: string): Record<string, unknown> {
  return query
    ? { deletedAt: null, name: { $regex: escapeRegex(query), $options: "i" } }
    : { deletedAt: null };
}

function invalidateCache(...keys: string[]) {
  keys.forEach((k) => cache.del(k));
}

function isPrivateHostname(hostname: string): boolean {
  const cleaned = hostname.replace(/^\[(.+)\]$/, "$1");
  if (net.isIPv6(cleaned)) {
    const parts = cleaned.split(":");
    if (cleaned === "::1" || cleaned === "0:0:0:0:0:0:0:1") return true;
    if (parts[0] === "fe80" || parts[0] === "fc" || parts[0] === "fd") return true;
    if (cleaned.startsWith("::ffff:") || cleaned.startsWith("::FFFF:")) {
      const ipv4 = cleaned.replace(/^::ffff:/i, "");
      return isPrivateHostname(ipv4);
    }
    return false;
  }
  const blockedIPv4 = [/^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])/, /^192\.168\./, /^0\./, /^169\.254\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])/];
  return blockedIPv4.some((p) => p.test(cleaned));
}

const lookupTool = (
  description: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Model: any,
  selectFields: string,
  cacheKey: string,
): ToolDefinition => ({
  description,
  inputSchema: z.object({ query: z.string().optional().default("") }),
  execute: async (args: Record<string, unknown>) => {
    const query = (args.query as string | undefined) || "";
    const results = await cachedQuery(`${cacheKey}:${query || "all"}`, CACHE_TTL, () =>
      Model.find(lookupFilter(query))
        .select(selectFields)
        .sort({ order: 1 }).limit(20).lean()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any[];
    return { count: results.length, results };
  },
});

const createEntityTool = <T extends Record<string, unknown>>(
  description: string,
  schema: z.ZodSchema<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Model: any,
  buildDoc: (parsed: T) => Record<string, unknown>,
  cacheKeys: string[],
  entityLabel: string,
  nameField = "name",
): ToolDefinition => ({
  description,
  inputSchema: schema,
  execute: async (args: Record<string, unknown>) => {
    const parsed = schema.parse(args) as T;
    const name = (parsed as unknown as Record<string, string | undefined>)[nameField];
    if (name) {
      const existing = await Model.findOne({ [nameField]: { $regex: `^${escapeRegex(name.trim())}$`, $options: "i" }, deletedAt: null }).select("_id").lean();
      if (existing) {
        invalidateCache(...cacheKeys);
        return { id: existing._id, [nameField]: name, reused: true };
      }
    }
    const doc = new Model(buildDoc(parsed));
    let result;
    try { result = await doc.save(); } catch (saveErr) {
      if (isDuplicateError(saveErr)) return { error: `${entityLabel} "${name}" already exists` };
      throw saveErr;
    }
    invalidateCache(...cacheKeys);
    return { id: result._id, [nameField]: name };
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findExistingProduct(name: string | undefined): Promise<{ _id: unknown; name: string } | null> {
  if (!name) return Promise.resolve(null);
  return ProductModel.findOne({ name: { $regex: `^${escapeRegex(name.trim())}$`, $options: "i" }, deletedAt: null }).select("_id name").lean() as Promise<{ _id: unknown; name: string } | null>;
}

export const agentTools: Record<string, ToolDefinition> = {
  searchProducts: {
    description: "Search products by name or description. Returns matching products with key details.",
    inputSchema: searchProductSchema,
    execute: async (args: Record<string, unknown>) => {
      const { query, limit } = args as { query: string; limit?: number };
      const products = await ProductModel.find({
        deletedAt: null,
        $or: [
          { name: { $regex: escapeRegex(query), $options: "i" } },
          { description: { $regex: escapeRegex(query), $options: "i" } },
          { tags: { $regex: escapeRegex(query), $options: "i" } },
        ],
      })
        .select("name slug price discount_price stock status category")
        .populate("category", "name")
        .limit(limit ?? 10)
        .lean();
      return { found: products.length > 0, results: products };
    },
  },

  searchFaqs: {
    description: "Search FAQs by keyword in question or answer.",
    inputSchema: searchFaqSchema,
    execute: async (args: Record<string, unknown>) => {
      const { query, limit } = args as { query: string; limit?: number };
      const faqs = await FaqModel.find({
        deletedAt: null,
        $or: [
          { question: { $regex: escapeRegex(query), $options: "i" } },
          { answer: { $regex: escapeRegex(query), $options: "i" } },
        ],
      })
        .select("question answer status order")
        .limit(limit ?? 10)
        .lean();
      return { found: faqs.length > 0, results: faqs };
    },
  },

  lookupMaterials: lookupTool("List or search materials by name.", MaterialModel, "_id name order", "materialData"),

  lookupColors: lookupTool("List or search colors by name.", ColorModel, "_id name code order", "colorData"),

  lookupCategories: lookupTool("List or search categories by name.", CategoryModel, "_id name slug order", "categoryData"),

  lookupSubCategories: {
    description: "List or search sub-categories by name.",
    inputSchema: z.object({ query: z.string().optional().default("") }),
    execute: async (args: Record<string, unknown>) => {
      const query = (args.query as string | undefined) || "";
      const results = await cachedQuery(`subCategory:${query || "all"}`, CACHE_TTL, () =>
        SubCategoryModel.find(lookupFilter(query))
          .select("_id name slug category order")
          .populate("category", "name")
          .sort({ order: 1 }).limit(20).lean()
      );
      return { count: results.length, results };
    },
  },

  lookupSubSubCategories: {
    description: "List or search sub-sub-categories by name.",
    inputSchema: z.object({ query: z.string().optional().default("") }),
    execute: async (args: Record<string, unknown>) => {
      const query = (args.query as string | undefined) || "";
      const results = await cachedQuery(`subSubCategory:${query || "all"}`, CACHE_TTL, () =>
        SubSubCategoryModel.find(lookupFilter(query))
          .select("_id name slug subCategory order")
          .populate("subCategory", "name")
          .sort({ order: 1 }).limit(20).lean()
      );
      return { count: results.length, results };
    },
  },

  lookupWhyChooseUs: {
    description: "Search existing 'Why Choose Us' entries by title or description.",
    inputSchema: searchWhyChooseUsSchema,
    execute: async (args: Record<string, unknown>) => {
      const { query, limit } = args as { query: string; limit?: number };
      const entries = await WhyChooseUsModel.find({
        deletedAt: null,
        $or: [
          { title: { $regex: escapeRegex(query), $options: "i" } },
          { description: { $regex: escapeRegex(query), $options: "i" } },
        ],
      })
        .select("title description status")
        .limit(limit ?? 10).lean();
      return { count: entries.length, results: entries };
    },
  },

  createFaq: createEntityTool(
    "Create a new FAQ entry. Checks for duplicates by question.",
    faqSchema,
    FaqModel,
    (p) => p as Record<string, unknown>,
    ["faqData"],
    "FAQ",
    "question",
  ),

  createMaterial: createEntityTool(
    "Create a new material option. Checks for duplicates by name.",
    materialSchema,
    MaterialModel,
    (p) => p as Record<string, unknown>,
    ["materialData"],
    "Material",
  ),

  createColor: {
    description: "Create a new color option. Auto-generates hex code from color name if not provided. Checks for duplicates by name.",
    inputSchema: colorSchema,
    execute: async (args: Record<string, unknown>) => {
      const parsed = colorSchema.parse(args);
      const existing = await ColorModel.findOne({ name: { $regex: `^${escapeRegex(parsed.name.trim())}$`, $options: "i" }, deletedAt: null }).select("_id name code").lean() as { _id: unknown; name: string; code?: string } | null;
      if (existing) {
        invalidateCache("colorData");
        return { id: existing._id, name: existing.name, reused: true, code: existing.code };
      }
      const doc = new ColorModel({
        name: parsed.name, code: parsed.code || colorNameToHex(parsed.name),
        order: parsed.order, status: parsed.status,
      });
      let result;
      try { result = await doc.save(); } catch (saveErr) {
        if (isDuplicateError(saveErr)) return { error: `Color "${parsed.name}" already exists` };
        throw saveErr;
      }
      invalidateCache("colorData");
      return { id: result._id, name: parsed.name, code: doc.code };
    },
  },

  createProductDraft: {
    description: "Create a new product in INACTIVE status. Requires name, description, price, category IDs, and color IDs.",
    inputSchema: productDraftSchema,
    execute: async (args: Record<string, unknown>) => {
      const parsed = productDraftSchema.parse(args);
      if (parsed.discount_price !== undefined && parsed.discount_price > parsed.price)
        return { error: "Discount price must be less than or equal to the original price" };
      if (parsed.minimumAge !== undefined && parsed.maximumAge !== undefined && parsed.minimumAge >= parsed.maximumAge)
        return { error: "Minimum age must be less than maximum age" };

      const existingProduct = await findExistingProduct(parsed.name);
      if (existingProduct) {
        invalidateCache("newArrivals", "trendingProducts", "bestSellers");
        return { id: existingProduct._id, name: existingProduct.name, reused: true };
      }

      const [categories, subCategories, colors, subSubCategories, materials] = await Promise.all([
        Promise.all(parsed.category.map((id: string) => CategoryModel.findById(id).select("_id").lean())),
        Promise.all(parsed.subCategory.map((id: string) => SubCategoryModel.findById(id).select("_id").lean())),
        Promise.all(parsed.colors.map((id: string) => ColorModel.findById(id).select("_id").lean())),
        Promise.all(parsed.subSubCategory.map((id: string) => SubSubCategoryModel.findById(id).select("_id").lean())),
        Promise.all(parsed.material.map((id: string) => MaterialModel.findById(id).select("_id").lean())),
      ]);

      const missing = [
        ...parsed.category.map((id: string, i: number) => !categories[i] ? `Category "${id}"` : null),
        ...parsed.subCategory.map((id: string, i: number) => !subCategories[i] ? `SubCategory "${id}"` : null),
        ...parsed.colors.map((id: string, i: number) => !colors[i] ? `Color "${id}"` : null),
        ...parsed.subSubCategory.map((id: string, i: number) => !subSubCategories[i] ? `SubSubCategory "${id}"` : null),
        ...parsed.material.map((id: string, i: number) => !materials[i] ? `Material "${id}"` : null),
      ].filter(Boolean);
      if (missing.length > 0) return { error: `Not found: ${missing.join(", ")}` };

      const productData: Record<string, unknown> = {
        ...parsed, status: "inactive",
        code: parsed.code || `DRAFT-${Date.now()}`,
        slug: await generateSlug(parsed.name),
      };
      const doc = new ProductModel(productData);
      let result;
      try { result = await doc.save(); } catch (saveErr) {
        if (isDuplicateError(saveErr)) return { error: `Product "${parsed.name}" already exists (duplicate slug or name)` };
        throw saveErr;
      }
      invalidateCache("newArrivals", "trendingProducts", "bestSellers");
      return { id: result._id, name: parsed.name, status: "inactive" };
    },
  },

  createCategory: createEntityTool(
    "Create a new product category. Checks for duplicates by name.",
    createCategorySchema,
    CategoryModel,
    (p) => {
      const parsed = p as z.infer<typeof createCategorySchema>;
      return { name: parsed.name, slug: slugify(parsed.name), description: parsed.description || "", order: parsed.order, status: parsed.status };
    },
    ["categoryData"],
    "Category",
  ),

  createSubCategory: {
    description: "Create a new sub-category under a parent category. Checks for duplicates by name.",
    inputSchema: createSubCategorySchema,
    execute: async (args: Record<string, unknown>) => {
      const parsed = createSubCategorySchema.parse(args);
      const existing = await SubCategoryModel.findOne({ name: { $regex: `^${escapeRegex(parsed.name.trim())}$`, $options: "i" }, deletedAt: null }).select("_id").lean() as { _id: unknown } | null;
      if (existing) { return { id: existing._id, name: parsed.name, reused: true }; }
      const categoriesExist = await Promise.all(parsed.category.map((id) => CategoryModel.findById(id).select("_id").lean()));
      if (categoriesExist.some((c) => !c)) return { error: "One or more parent categories not found" };

      const doc = new SubCategoryModel({ name: parsed.name, slug: slugify(parsed.name), category: parsed.category, description: parsed.description || "", order: parsed.order, status: parsed.status });
      let result;
      try { result = await doc.save(); } catch (saveErr) {
        if (isDuplicateError(saveErr)) return { error: `SubCategory "${parsed.name}" already exists` };
        throw saveErr;
      }
      return { id: result._id, name: parsed.name };
    },
  },

  createSubSubCategory: {
    description: "Create a new sub-sub-category under a parent sub-category. Checks for duplicates by name.",
    inputSchema: createSubSubCategorySchema,
    execute: async (args: Record<string, unknown>) => {
      const parsed = createSubSubCategorySchema.parse(args);
      const existing = await SubSubCategoryModel.findOne({ name: { $regex: `^${escapeRegex(parsed.name.trim())}$`, $options: "i" }, deletedAt: null }).select("_id").lean() as { _id: unknown } | null;
      if (existing) { return { id: existing._id, name: parsed.name, reused: true }; }
      const subsExist = await Promise.all(parsed.subCategory.map((id) => SubCategoryModel.findById(id).select("_id").lean()));
      if (subsExist.some((s) => !s)) return { error: "One or more parent sub-categories not found" };

      const doc = new SubSubCategoryModel({ name: parsed.name, slug: slugify(parsed.name), subCategory: parsed.subCategory, description: parsed.description || "", order: parsed.order, status: parsed.status });
      let result;
      try { result = await doc.save(); } catch (saveErr) {
        if (isDuplicateError(saveErr)) return { error: `SubSubCategory "${parsed.name}" already exists` };
        throw saveErr;
      }
      return { id: result._id, name: parsed.name };
    },
  },

  updateProduct: {
    description: "Update an existing product's fields (status, price, stock, flags). Executes immediately.",
    inputSchema: updateProductSchema,
    execute: async (args: Record<string, unknown>) => {
      const parsed = updateProductSchema.parse(args);
      const existing = await ProductModel.findById(parsed.productId);
      if (!existing) return { error: `Product with ID "${parsed.productId}" not found` };
      const updateFields: Record<string, unknown> = {};
      if (parsed.status !== undefined) updateFields.status = parsed.status;
      if (parsed.price !== undefined) updateFields.price = parsed.price;
      if (parsed.discount_price !== undefined) updateFields.discount_price = parsed.discount_price;
      if (parsed.stock !== undefined) updateFields.stock = parsed.stock;
      if (parsed.isFeatured !== undefined) updateFields.isFeatured = parsed.isFeatured;
      if (parsed.isNewArrival !== undefined) updateFields.isNewArrival = parsed.isNewArrival;
      if (parsed.isBestSeller !== undefined) updateFields.isBestSeller = parsed.isBestSeller;
      if (parsed.isOnSale !== undefined) updateFields.isOnSale = parsed.isOnSale;
      if (parsed.isGift !== undefined) updateFields.isGift = parsed.isGift;
      if (parsed.isPersonalized !== undefined) updateFields.isPersonalized = parsed.isPersonalized;
      const updated = await ProductModel.findByIdAndUpdate(parsed.productId, { $set: updateFields }, { new: true, runValidators: true });
      if (!updated) return { error: "Failed to update product" };
      invalidateCache("newArrivals", "trendingProducts", "bestSellers");
      return { id: updated._id, name: updated.name, changes: updateFields };
    },
  },

  createBanner: createEntityTool(
    "Create a new banner. Checks for duplicates by description.",
    createBannerSchema,
    BannerModel,
    (p) => {
      const parsed = p as z.infer<typeof createBannerSchema>;
      return { description: parsed.description, order: parsed.order, status: parsed.status };
    },
    ["bannerData"],
    "Banner",
    "description",
  ),

  createTestimonial: createEntityTool(
    "Create a new testimonial. Checks for duplicates by title.",
    createTestimonialSchema,
    TestimonialModel,
    (p) => {
      const parsed = p as z.infer<typeof createTestimonialSchema>;
      return { title: parsed.title, description: parsed.description, rating: parsed.rating, address: parsed.address, image: parsed.image || "https://placehold.co/100x100?text=Testimonial", status: parsed.status };
    },
    ["testimonialData"],
    "Testimonial",
    "title",
  ),

  createWhyChooseUs: {
    description: "Create a new 'Why Choose Us' entry. Checks for duplicates by title.",
    inputSchema: createWhyChooseUsSchema,
    execute: async (args: Record<string, unknown>) => {
      const parsed = createWhyChooseUsSchema.parse(args);
      const existing = await WhyChooseUsModel.findOne({ title: { $regex: `^${escapeRegex(parsed.title.trim())}$`, $options: "i" }, deletedAt: null }).select("_id title").lean() as { _id: unknown; title: string } | null;
      if (existing) {
        invalidateCache("whyChooseUsData");
        return { id: existing._id, title: existing.title, reused: true };
      }
      const doc = new WhyChooseUsModel({ title: parsed.title, description: parsed.description, status: parsed.status });
      let result;
      try { result = await doc.save(); } catch (saveErr) {
        if (isDuplicateError(saveErr)) return { error: `Why Choose Us "${parsed.title}" already exists` };
        throw saveErr;
      }
      invalidateCache("whyChooseUsData");
      return { id: result._id, title: parsed.title };
    },
  },

  createCoupon: {
    description: "Create a new discount coupon. Checks for duplicate code.",
    inputSchema: createCouponSchema,
    execute: async (args: Record<string, unknown>) => {
      const parsed = createCouponSchema.parse(args);
      const code = parsed.code.toUpperCase();
      const existing = await CoupenModel.findOne({ code, deletedAt: null }).select("_id code").lean() as { _id: unknown; code: string } | null;
      if (existing) return { id: existing._id, code, reused: true };
      const doc = new CoupenModel({ name: parsed.name, code, discountPercentage: parsed.discountPercentage, minAmount: parsed.minAmount, maxAmount: parsed.maxAmount, description: parsed.description || "", expiryDate: parsed.expiryDate ? new Date(parsed.expiryDate) : null, status: parsed.status, type: parsed.type });
      let result;
      try { result = await doc.save(); } catch (saveErr) {
        if (isDuplicateError(saveErr)) return { error: `Coupon code "${code}" already exists` };
        throw saveErr;
      }
      invalidateCache("coupenData");
      return { id: result._id, name: parsed.name, code, reused: false };
    },
  },

  searchWeb: {
    description: "Search the web for information using Wikipedia. Works without any API keys.",
    inputSchema: searchWebSchema,
    execute: async (args: Record<string, unknown>) => {
      const query = (args.query as string) || "";
      try {
        const searchUrl = `https://en.wikipedia.org/api/rest_v1/search/page?q=${encodeURIComponent(query)}&limit=5`;
        const searchResp = await fetch(searchUrl);
        if (!searchResp.ok) return { error: `Search failed with status ${searchResp.status}` };
        const searchData = (await searchResp.json()) as { pages?: Array<{ id: number; title: string; description?: string; extract?: string }> };
        if (!searchData.pages || searchData.pages.length === 0) return { results: [], note: "No Wikipedia results found." };
        interface WikiResult { title: string; description: string; snippet: string; url: string }
        const settled = await Promise.allSettled(
          searchData.pages.slice(0, 5).map(async (page): Promise<WikiResult> => {
            const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`;
            const summaryResp = await fetch(summaryUrl);
            if (summaryResp.ok) {
              const summary = (await summaryResp.json()) as { extract?: string; content_urls?: { desktop?: { page?: string } } };
              return { title: page.title, description: page.description || "", snippet: (summary.extract || "").slice(0, 1000), url: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}` };
            }
            return { title: page.title, description: page.description || "", snippet: (page.extract || "").slice(0, 500), url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}` };
          }),
        );
        const wikiResults: WikiResult[] = [];
        for (const r of settled) { if (r.status === "fulfilled") wikiResults.push(r.value); }
        return { results: wikiResults, source: "Wikipedia" };
      } catch (err) {
        logger.error({ err }, "Web search failed");
        return { error: err instanceof Error ? err.message : "Search request failed" };
      }
    },
  },

  fetchUrl: {
    description: "Fetch and read content from a URL (public http/https only). Returns plain text with links.",
    inputSchema: fetchUrlSchema,
    execute: async (args: Record<string, unknown>) => {
      const { url, maxChars } = args as { url: string; maxChars?: number };
      try {
        let parsedUrl: URL;
        try { parsedUrl = new URL(url); } catch { return { error: "Invalid URL format" }; }
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:")
          return { error: "Only http and https URLs are allowed" };
        if (isPrivateHostname(parsedUrl.hostname))
          return { error: "URL points to a private or internal network, which is not allowed" };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "JewelleryWalla-Admin/1.0 (AI agent; internal use)", Accept: "text/html,text/plain,*/*" } });
        clearTimeout(timeout);
        if (!resp.ok) return { error: `Failed to fetch URL: ${resp.status} ${resp.statusText}` };
        const text = await resp.text();
        const maxLen = maxChars ?? 5000;
        const plainText = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/&[a-z]+;/g, " ").trim().slice(0, maxLen);
        return { url, content: plainText, truncated: text.length > maxLen, characters: plainText.length };
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return { error: "Request timed out after 10 seconds" };
        logger.error({ err }, "fetchUrl failed");
        return { error: err instanceof Error ? err.message : "Failed to fetch URL" };
      }
    },
  },

  getCurrentTime: {
    description: "Get the current date and time.",
    inputSchema: z.object({}),
    execute: async () => {
      const now = new Date();
      return { date: now.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }), time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }), iso: now.toISOString(), timestamp: now.getTime() };
    },
  },
};

/**
 * Wrap all tool execute functions to strip non-JSON-serializable types
 * (MongoDB ObjectIds, Date instances, etc.) from return values.
 *
 * The AI SDK's internal tool-call loop validates tool results against the
 * model provider's schema before sending them back to the model. MongoDB
 * ObjectIds (from .lean() or ._id) are not valid in the provider's schema
 * and cause AI_InvalidPromptError / TypeValidationError.
 *
 * JSON.parse(JSON.stringify(result)) recursively converts ObjectIds,
 * Dates, Buffers, and Maps to their plain JSON equivalents.
 */
for (const key of Object.keys(agentTools)) {
  const tool = agentTools[key]!;
  const originalExecute = tool.execute;
  tool.execute = async (args: Record<string, unknown>) => {
    const result = await originalExecute(args);
    return JSON.parse(JSON.stringify(result));
  };
}
