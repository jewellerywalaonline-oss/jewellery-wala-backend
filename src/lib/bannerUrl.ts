import Product from "../models/product.js";
import Category from "../models/category.js";
import SubCategory from "../models/subCategory.js";
import SubSubCategory from "../models/subSubCategory.js";

type BannerLinkInput =
  | { type: "product"; target: string }
  | { type: "category"; target: string }
  | { type: "subCategory"; target: string }
  | { type: "subSubCategory"; target: string }
  | { type: "external"; externalUrl: string };

export async function resolveBannerLink(input: BannerLinkInput): Promise<{ url: string; label: string }> {
  switch (input.type) {
    case "product": {
      const p = await Product.findById(input.target).select("slug name").lean();
      if (!p) throw new Error("Product not found");
      return { url: `/product-details/${p.slug}`, label: p.name };
    }
    case "category": {
      const c = await Category.findById(input.target).select("slug name").lean();
      if (!c) throw new Error("Category not found");
      return { url: `/category/${c.slug}`, label: c.name };
    }
    case "subCategory": {
      const sc = await SubCategory.findById(input.target)
        .select("slug name category")
        .populate<{ category: { _id: string; slug: string } }>("category", "slug")
        .lean();
      if (!sc || !sc.category) throw new Error("Sub category not found");
      return { url: `/category/${sc.category.slug}/${sc.slug}`, label: sc.name };
    }
    case "subSubCategory": {
      const ssc = await SubSubCategory.findById(input.target)
        .select("slug name subCategory")
        .populate<{
          subCategory: {
            _id: string;
            slug: string;
            category: { _id: string; slug: string };
          };
        }>({
          path: "subCategory",
          select: "slug category",
          populate: { path: "category", select: "slug" },
        })
        .lean();
      if (!ssc || !ssc.subCategory || !ssc.subCategory.category) throw new Error("Sub-sub category not found");
      return {
        url: `/category/${ssc.subCategory.category.slug}/${ssc.subCategory.slug}/${ssc.slug}`,
        label: ssc.name,
      };
    }
    case "external": {
      try {
        const u = new URL(input.externalUrl);
        if (!/^https?:$/.test(u.protocol)) throw new Error("Invalid protocol");
        return { url: u.toString(), label: u.hostname };
      } catch {
        throw new Error("Invalid external URL");
      }
    }
  }
}
