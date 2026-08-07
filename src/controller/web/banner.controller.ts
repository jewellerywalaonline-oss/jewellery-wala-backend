import Banner from "../../models/banner.js";
import Product from "../../models/product.js";
import Category from "../../models/category.js";
import SubCategory from "../../models/subCategory.js";
import SubSubCategory from "../../models/subSubCategory.js";
import { buildCacheListController } from "./_helpers.js";
import type { Request } from "express";

interface ModelWithSlug {
  _id: string;
  slug: string;
}

const fetchBanners = async (_req: Request) => {
  const banners = await Banner.find({ deletedAt: null, status: true })
    .select("-createdAt -updatedAt -deletedAt")
    .sort({ order: 1, _id: -1 })
    .lean();

  const productIds: string[] = [];
  const categoryIds: string[] = [];
  const subCategoryIds: string[] = [];
  const subSubCategoryIds: string[] = [];

  for (const b of banners) {
    const link = b.link;
    if (!link || !link.type || !link.target) continue;
    if (link.type === "product") productIds.push(String(link.target));
    else if (link.type === "category") categoryIds.push(String(link.target));
    else if (link.type === "subCategory") subCategoryIds.push(String(link.target));
    else if (link.type === "subSubCategory") subSubCategoryIds.push(String(link.target));
  }

  const [products, categories, subCategories, subSubCategories] = await Promise.all([
    productIds.length > 0
      ? Product.find({ _id: { $in: productIds } }).select("slug").lean()
      : [],
    categoryIds.length > 0
      ? Category.find({ _id: { $in: categoryIds } }).select("slug").lean()
      : [],
    subCategoryIds.length > 0
      ? SubCategory.find({ _id: { $in: subCategoryIds } }).select("slug").lean()
      : [],
    subSubCategoryIds.length > 0
      ? SubSubCategory.find({ _id: { $in: subSubCategoryIds } }).select("slug").lean()
      : [],
  ]);

  const productSlugMap = new Map<string, string>(
    (products as ModelWithSlug[]).map((p) => [String(p._id), p.slug]),
  );
  const categorySlugMap = new Map<string, string>(
    (categories as ModelWithSlug[]).map((c) => [String(c._id), c.slug]),
  );
  const subCategorySlugMap = new Map<string, string>(
    (subCategories as ModelWithSlug[]).map((s) => [String(s._id), s.slug]),
  );
  const subSubCategorySlugMap = new Map<string, string>(
    (subSubCategories as ModelWithSlug[]).map((s) => [String(s._id), s.slug]),
  );

  return banners.map((b) => {
    const link = b.link as (typeof b.link) & { url?: string | null } | null;
    if (!link || !link.type) return b;

    let url: string | null = null;
    if (link.type === "external") {
      url = link.externalUrl || null;
    } else if (link.type === "product") {
      const slug = productSlugMap.get(String(link.target));
      if (slug) url = `/product-details/${slug}`;
    } else if (link.type === "category") {
      const slug = categorySlugMap.get(String(link.target));
      if (slug) url = `/category/${slug}`;
    } else if (link.type === "subCategory") {
      const slug = subCategorySlugMap.get(String(link.target));
      if (slug) url = `/category/${slug}`;
    } else if (link.type === "subSubCategory") {
      const slug = subSubCategorySlugMap.get(String(link.target));
      if (slug) url = `/category/${slug}`;
    }

    (link as (typeof b.link) & { url?: string | null }).url = url;
    return b;
  });
};

export const bannerController = buildCacheListController(Banner, {
  cacheKey: "bannerData",
  fetcher: fetchBanners,
  ttl: 3600, // 1 hour — banners rarely change, cache invalidated on admin CRUD
});

/**
 * GET /api/website/banner/:id
 * Returns a single active banner by its ID with resolved links.
 * Used by category pages to display a category-specific banner.
 */
export const getBannerById = async (
  req: import("express").Request,
  res: import("express").Response,
): Promise<void> => {
  try {
    const banner = await Banner.findOne({
      _id: req.params.id,
      deletedAt: null,
      status: true,
    })
      .select("-createdAt -updatedAt -deletedAt")
      .lean();

    if (!banner) {
      res.status(404).json({ _status: false, _message: "Banner not found", _data: null });
      return;
    }

    // Resolve the link target to a URL (same logic as fetchBanners)
    const link = banner.link as Record<string, unknown> | null;
    if (link && link.type && link.target) {
      let slug: string | null = null;

      if (link.type === "product") {
        const product = await Product.findById(String(link.target)).select("slug").lean();
        if (product) slug = (product as { slug: string }).slug;
      } else if (link.type === "category") {
        const cat = await Category.findById(String(link.target)).select("slug").lean();
        if (cat) slug = (cat as { slug: string }).slug;
      } else if (link.type === "subCategory") {
        const sub = await SubCategory.findById(String(link.target)).select("slug").lean();
        if (sub) slug = (sub as { slug: string }).slug;
      } else if (link.type === "subSubCategory") {
        const subsub = await SubSubCategory.findById(String(link.target)).select("slug").lean();
        if (subsub) slug = (subsub as { slug: string }).slug;
      }

      let url: string | null = null;
      if (link.type === "external") {
        url = (link as Record<string, unknown>).externalUrl as string | null || null;
      } else if (slug) {
        if (link.type === "product") url = `/product-details/${slug}`;
        else url = `/category/${slug}`;
      }

      (link as Record<string, unknown>).url = url;
    }

    res.json({ _status: true, _data: banner });
  } catch (err) {
    res.status(500).json({ _status: false, _message: "Failed to fetch banner", _data: null });
  }
};
