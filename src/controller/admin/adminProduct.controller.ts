import crypto from "crypto";
import type { Request, Response } from "express";
import Product from "../../models/product.js";
import Category from "../../models/category.js";
import SubCategory from "../../models/subCategory.js";
import { logger } from "../../lib/logger.js";
import SubSubCategory from "../../models/subSubCategory.js";
import Color from "../../models/color.js";
import Size from "../../models/size.js";
import { uploadToR2, deleteFromR2, getPublicUrlBase } from "../../lib/cloudflare.js";
import { generateUniqueSlug } from "../../lib/slugFunc.js";
import cache from "../../lib/cache.js";

const POPULATE_PRODUCT = [
  { path: "colors", select: "name code" },
  { path: "material", select: "name" },
  { path: "sizes", select: "name" },
  { path: "category", select: "name slug" },
  { path: "subCategory", select: "name slug" },
  { path: "subSubCategory", select: "name slug" },
];

const invalidateProductCaches = (): void => {
  cache.del("newArrivals");
  cache.del("trendingProducts");
  cache.del("featuredForFooter");
  cache.del("tabProducts");
  cache.del("bestSellers");
};

interface ParsedVariant {
  name: string;
  quantity: number;
  price: number;
  mrp?: number | null;
}

/**
 * Parse the `variants` field coming from the admin form. The form sends it as
 * a JSON string (FormData has no nested arrays). Normalizes to a clean array
 * and validates each row. Throws on invalid input.
 */
const parseVariants = (raw: unknown): ParsedVariant[] => {
  let arr: unknown;
  if (typeof raw === "string") {
    if (!raw.trim()) return [];
    try {
      arr = JSON.parse(raw);
    } catch {
      throw new Error("Variants must be valid JSON");
    }
  } else {
    arr = raw;
  }

  if (arr === undefined || arr === null) return [];
  if (!Array.isArray(arr)) {
    throw new Error("Variants must be an array");
  }

  const variants: ParsedVariant[] = [];
  for (const item of arr) {
    const v = (item ?? {}) as Record<string, unknown>;
    const name = typeof v.name === "string" ? v.name.trim() : "";
    const quantity = Number(v.quantity);
    const price = Number(v.price);
    const mrp = v.mrp == null || v.mrp === "" ? null : Number(v.mrp);

    if (!name) {
      throw new Error("Every variant needs a name");
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Variant "${name}" must have a quantity of at least 1`);
    }
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Variant "${name}" must have a price greater than 0`);
    }
    if (mrp !== null && (!Number.isFinite(mrp) || mrp < price)) {
      throw new Error(`Variant "${name}" MRP must be greater than or equal to its price`);
    }

    variants.push({ name, quantity, price, mrp });
  }
  return variants;
};

const collectValidationMessages = (err: unknown): string[] => {
  const errObj = err as Record<string, unknown>;
  if (errObj?.errors) {
    const messages: string[] = [];
    const errors = errObj.errors as Record<string, { message: string }>;
    for (const msg in errors) {
      if (errors[msg]?.message) messages.push(errors[msg].message);
    }
    return messages;
  }
  return [
    errObj?.message as string ?? (err instanceof Error ? err.message : "Something went wrong"),
  ];
};

export const create = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const productDoc = new Product(request.body);
    const updateData: Record<string, unknown> = { ...request.body };

    const files = request.files as Express.Multer.File[] | undefined;
    const filesObj = files as unknown as Record<string, Express.Multer.File[]> | undefined;
    const productName = updateData.name as string | undefined;

    if (filesObj) {
      if (filesObj.image && filesObj.image[0]) {
        const uploadResult = await uploadToR2(filesObj.image[0], "products", 85, productName);
        if (uploadResult.success) {
          updateData.image = uploadResult.url;
        } else {
          throw new Error("Failed to upload main image");
        }
      }

      if (filesObj.images && filesObj.images.length > 0) {
        const imageUrls: string[] = [];
        for (const file of filesObj.images) {
          const uploadResult = await uploadToR2(file, "products", 80, productName);
          if (uploadResult.success) {
            imageUrls.push(uploadResult.url);
          }
        }
        updateData.images = imageUrls;
      }

      if (filesObj.giftImages && filesObj.giftImages.length > 0) {
        const giftImageUrls: string[] = [];
        for (const file of filesObj.giftImages) {
          const uploadResult = await uploadToR2(file, "products", 80, productName);
          if (uploadResult.success) {
            giftImageUrls.push(uploadResult.url);
          }
        }
        updateData.giftImages = giftImageUrls;
      }
    }

    const slug = await generateUniqueSlug(Product, updateData.name as string);
    updateData.slug = slug;

    // ── Auto-generate code if not provided ──
    if (!updateData.code) {
      updateData.code = crypto.randomUUID().replace(/-/g, "").substring(0, 6).toUpperCase();
    }

    // ── Auto-generate SKU if not provided ──
    if (!updateData.sku) {
      const now = new Date();
      const yymmdd = now.getFullYear().toString().slice(2) +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0");
      const random = crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
      updateData.sku = `JWL-${yymmdd}-${random}`;
    }

    // ── Price & discount price mutual validation ──
    if ((!updateData.price) !== (!updateData.discount_price)) {
      throw new Error("Both price and discount price must be provided together");
    }

    // ── Price validation ──
    const priceVal = Number(updateData.price);
    if (!isNaN(priceVal) && priceVal <= 0) {
      throw new Error("Price must be greater than 0");
    }
    const discountVal = Number(updateData.discount_price);
    if (!isNaN(priceVal) && !isNaN(discountVal) && discountVal > priceVal) {
      throw new Error("Discount price must be less than or equal to the original price");
    }

    // ── Stock validation ──
    const stockVal = Number(updateData.stock);
    if (isNaN(stockVal) || stockVal < 0) {
      throw new Error("Stock cannot be negative");
    }

    // ── Variants validation ──
    if (updateData.variants !== undefined) {
      updateData.variants = parseVariants(updateData.variants);
    }

    // ── Dimensions mutual validation ──
    const hasLen = updateData.length !== '' && updateData.length != null;
    const hasHgt = updateData.height !== '' && updateData.height != null;
    const hasBrd = updateData.breadth !== '' && updateData.breadth != null;
    const dimCount = [hasLen, hasHgt, hasBrd].filter(Boolean).length;
    if (dimCount > 0 && dimCount < 3) {
      throw new Error("Length, height, and breadth must all be provided together");
    }

    // ── Required fields ──
    if (!updateData.category || (Array.isArray(updateData.category) && updateData.category.length === 0)) {
      throw new Error("At least one category is required");
    }

    if (!updateData.colors || (Array.isArray(updateData.colors) && updateData.colors.length === 0)) {
      throw new Error("At least one color is required");
    }

    if (updateData.category) {
      const categoryIds = Array.isArray(updateData.category)
        ? updateData.category
        : [updateData.category];
      for (const catId of categoryIds) {
        const categoryExists = await Category.findById(catId as string).select("_id").lean();
        if (!categoryExists) {
          throw new Error(`Category with ID ${catId} not found`);
        }
      }
    }

    if (updateData.subCategory) {
      const subCategoryIds = Array.isArray(updateData.subCategory)
        ? updateData.subCategory
        : [updateData.subCategory];
      for (const subCatId of subCategoryIds) {
        const subCategoryExists = await SubCategory.findById(subCatId as string).select("_id").lean();
        if (!subCategoryExists) {
          throw new Error(`SubCategory with ID ${subCatId} not found`);
        }
      }
    }

    if (updateData.subSubCategory) {
      const subSubCategoryIds = Array.isArray(updateData.subSubCategory)
        ? updateData.subSubCategory
        : [updateData.subSubCategory];
      for (const subSubCatId of subSubCategoryIds) {
        const subSubCategoryExists = await SubSubCategory.findById(subSubCatId as string).select("_id").lean();
        if (!subSubCategoryExists) {
          throw new Error(`SubSubCategory with ID ${subSubCatId} not found`);
        }
      }
    }

    if (updateData.colors) {
      const colorIds = Array.isArray(updateData.colors) ? updateData.colors : [updateData.colors];
      for (const colorId of colorIds) {
        const colorExists = await Color.findById(colorId as string).select("_id").lean();
        if (!colorExists) {
          throw new Error(`Color with ID ${colorId} not found`);
        }
      }
    }

    // ── Sizes validation ──
    if (updateData.sizes) {
      const sizeIds = Array.isArray(updateData.sizes) ? updateData.sizes : [updateData.sizes];
      for (const sizeId of sizeIds) {
        const sizeExists = await Size.findById(sizeId as string).select("_id").lean();
        if (!sizeExists) {
          throw new Error(`Size with ID ${sizeId} not found`);
        }
      }
    }

    Object.assign(productDoc, updateData);
    const ress = await productDoc.save();
    invalidateProductCaches();response.status(200).json({ _status: true,
      _message: "Product created successfully",
      _data: ress,
    });
  } catch (err) {response.status(500).json({ _status: false,
      _message: collectValidationMessages(err),
      _data: [],
    });
  }
};

export const view = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const {
      categories,
      subCategories,
      subSubCategories,
      minPrice,
      maxPrice,
      search,
      sort = "-createdAt",
      inStock,
      page: rawPage,
      limit: rawLimit,
    } = request.query as Record<string, string | undefined>;

    const page = Math.max(1, Number(request.body?.page ?? rawPage ?? 1));
    const limit = Math.min(Math.max(1, Number(request.body?.limit ?? rawLimit ?? 50)), 200);
    const skip = (page - 1) * limit;

    const isDeletedAt = (request.body?.isDeletedAt ?? request.query?.isDeletedAt) as string | undefined;

    const query: Record<string, unknown> = {};
    if (isDeletedAt === "all") {
      // no deletedAt filter — show everything
    } else if (isDeletedAt === "deleted") {
      query.deletedAt = { $ne: null };
    } else {
      query.deletedAt = null;
    }

    // Support search via request.body.name (used by admin panel bento grid picker)
    if (request.body?.name) {
      query.$text = { $search: request.body.name.trim() };
    }

    if (categories) {
      query.categories = Array.isArray(categories)
        ? { $in: categories }
        : categories;
    }
    if (subCategories) {
      query.subCategories = Array.isArray(subCategories)
        ? { $in: subCategories }
        : subCategories;
    }
    if (subSubCategories) {
      query.subSubCategories = Array.isArray(subSubCategories)
        ? { $in: subSubCategories }
        : subSubCategories;
    }

    const priceQuery: Record<string, unknown> = {};
    if (minPrice || maxPrice) {
      if (minPrice) priceQuery.$gte = Number(minPrice);
      if (maxPrice) priceQuery.$lte = Number(maxPrice);
      query.price = priceQuery;
    }

    if (inStock === "true") {
      query.stock = { $gt: 0 };
    }

    if (search) {
      query.$text = { $search: search.trim() };
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .select("name slug image images giftImages price discount_price stock status description shortDescription weight code length height breadth purity sizes type sku tags videoUrl estimated_delivery_time isFeatured isNewArrival isBestSeller isOnSale isUpsell category subCategory subSubCategory colors material createdAt order variants")
        .sort(sort as string)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);response.status(200).json({ _status: true,
      _message: "Products fetched successfully",
      _data: products,
      _pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (_err) {response.status(500).json({ _status: false,
      _message: "Something went wrong",
      _data: [],
    });
  }
};

export const getOne = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const { id: rawId, slug } = request.params;
    const id = Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "";

    let product = await Product.findById(id).populate(POPULATE_PRODUCT).lean();

    if (!product && slug) {
      product = await Product.findOne({ slug }).populate(POPULATE_PRODUCT).lean();
    }

    if (!product) {
      response.status(404).json({
        _status: false,
        _message: "Product not found",
        _data: null,
      });
      return;
    }
response.status(200).json({ _status: true,
      _message: "Product fetched successfully",
      _data: product,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Something went wrong",
      _data: null,
    });
  }
};

export const update = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const { id } = request.params;
    const updateData: Record<string, unknown> = { ...request.body };
    const removeImagesUrl: string[] = (updateData.removeImagesUrl as string[]) ?? [];
    const removeGiftImagesUrl: string[] = (updateData.removeGiftImagesUrl as string[]) ?? [];

    const existingProduct = await Product.findOne({ _id: id, deletedAt: null })
      .select("name images giftImages videoUrl category subCategory subSubCategory sizes slug")
      .lean();
    if (!existingProduct) {
      throw new Error("Product not found");
    }

    const r2PublicBase = getPublicUrlBase();

    const allRemoveUrls = [...removeImagesUrl, ...removeGiftImagesUrl];
    if (allRemoveUrls.length > 0) {
      for (const imageUrl of allRemoveUrls) {
        if (typeof imageUrl === "string" && imageUrl.startsWith(r2PublicBase)) {
          const fileName = imageUrl.slice(r2PublicBase.length);
          deleteFromR2(fileName).catch((err) =>
            logger.error({ err, fileName }, "Failed to delete R2 image"),
          );
        }
      }
    }

    const filesObj = request.files as unknown as Record<string, Express.Multer.File[]> | undefined;
    const productName = existingProduct.name || (updateData.name as string | undefined);

    if (filesObj) {
      if (filesObj.image && filesObj.image[0]) {
        const uploadResult = await uploadToR2(filesObj.image[0], "products", 80, productName);
        if (uploadResult.success) {
          updateData.image = uploadResult.url;
        } else {
          throw new Error("Failed to upload main image");
        }
      }

      if (filesObj.images && filesObj.images.length > 0) {
        const images: string[] = Array.isArray(existingProduct.images) 
          ? [...existingProduct.images] 
          : [];
        if (removeImagesUrl.length > 0) {
          updateData.images = images.filter(
            (image: string) => !removeImagesUrl.includes(image),
          );
        }

        for (const file of filesObj.images) {
          const uploadResult = await uploadToR2(file, "products", 80, productName);
          if (uploadResult?.success && uploadResult?.url) {
            (updateData.images as string[]).push(uploadResult.url);
          }
        }
      }

      if (filesObj.giftImages && filesObj.giftImages.length > 0) {
        const giftImages: string[] = Array.isArray(existingProduct.giftImages)
          ? [...existingProduct.giftImages]
          : [];

        if (removeGiftImagesUrl.length > 0) {
          updateData.giftImages = giftImages.filter(
            (url: string) => !removeGiftImagesUrl.includes(url),
          );
        } else {
          updateData.giftImages = giftImages;
        }

        for (const file of filesObj.giftImages) {
          const uploadResult = await uploadToR2(file, "products", 80, productName);
          if (uploadResult?.success && uploadResult?.url) {
            (updateData.giftImages as string[]).push(uploadResult.url);
          }
        }
      } else if (removeGiftImagesUrl.length > 0) {
        // No new gift images uploaded, but some existing ones are marked for removal
        const existingGiftImages: string[] = Array.isArray(existingProduct.giftImages)
          ? [...existingProduct.giftImages]
          : [];
        updateData.giftImages = existingGiftImages.filter(
          (url: string) => !removeGiftImagesUrl.includes(url),
        );
      }
    }

    // ── Price & discount price mutual validation (only if both fields were sent) ──
    const priceIncluded = updateData.price !== undefined;
    const discountIncluded = updateData.discount_price !== undefined;
    if (priceIncluded !== discountIncluded) {
      throw new Error("Both price and discount price must be provided together");
    }
    if (priceIncluded) {
      const priceVal = Number(updateData.price);
      if (!isNaN(priceVal) && priceVal <= 0) {
        throw new Error("Price must be greater than 0");
      }
      const discountVal = Number(updateData.discount_price);
      if (!isNaN(priceVal) && !isNaN(discountVal) && discountVal > priceVal) {
        throw new Error("Discount price must be less than or equal to the original price");
      }
    }

    // ── Stock validation (only if field was actually sent) ──
    if (updateData.stock !== undefined) {
      const stockVal = Number(updateData.stock);
      if (isNaN(stockVal) || stockVal < 0) {
        throw new Error("Stock cannot be negative");
      }
    }

    // ── Variants validation (only if field was actually sent) ──
    if (updateData.variants !== undefined) {
      updateData.variants = parseVariants(updateData.variants);
    }

    // ── Dimensions mutual validation (only if at least one dimension was sent) ──
    const lengthSent = updateData.length !== undefined;
    const heightSent = updateData.height !== undefined;
    const breadthSent = updateData.breadth !== undefined;
    if (lengthSent || heightSent || breadthSent) {
      const hasLen = updateData.length !== '' && updateData.length != null;
      const hasHgt = updateData.height !== '' && updateData.height != null;
      const hasBrd = updateData.breadth !== '' && updateData.breadth != null;
      const dimCount = [hasLen, hasHgt, hasBrd].filter(Boolean).length;
      if (dimCount > 0 && dimCount < 3) {
        throw new Error("Length, height, and breadth must all be provided together");
      }
    }

    if (updateData.name && updateData.name !== existingProduct.name) {
      const slug = await generateUniqueSlug(Product, updateData.name as string);
      updateData.slug = slug;
    }

    if (updateData.category) {
      const categoryIds = Array.isArray(updateData.category)
        ? updateData.category
        : [updateData.category];
      const existingCategoryIds: string[] = Array.isArray(existingProduct.category)
        ? (existingProduct.category as Array<{ toString(): string }>).map((c) =>
            c.toString(),
          )
        : [(existingProduct.category as { toString(): string }).toString()];

      const categoriesChanged =
        JSON.stringify(categoryIds.sort()) !==
        JSON.stringify(existingCategoryIds.sort());

      if (categoriesChanged) {
        for (const catId of categoryIds) {
          const categoryExists = await Category.findById(catId);
          if (!categoryExists) {
            throw new Error(`Category with ID ${catId} not found`);
          }
        }
      }
    }

    if (updateData.subCategory) {
      const subCategoryIds = Array.isArray(updateData.subCategory)
        ? updateData.subCategory
        : [updateData.subCategory];
      const existingSubCategoryIds: string[] = existingProduct.subCategory
        ? Array.isArray(existingProduct.subCategory)
          ? (existingProduct.subCategory as Array<{ toString(): string }>).map((s) =>
              s.toString(),
            )
          : [(existingProduct.subCategory as { toString(): string }).toString()]
        : [];

      const subCategoriesChanged =
        JSON.stringify(subCategoryIds.sort()) !==
        JSON.stringify(existingSubCategoryIds.sort());

      if (subCategoriesChanged) {
        for (const subCatId of subCategoryIds) {
          const subCategoryExists = await SubCategory.findById(subCatId);
          if (!subCategoryExists) {
            throw new Error(`SubCategory with ID ${subCatId} not found`);
          }
        }
      }
    }

    if (updateData.subSubCategory) {
      const subSubCategoryIds = Array.isArray(updateData.subSubCategory)
        ? updateData.subSubCategory
        : [updateData.subSubCategory];
      const existingSubSubCategoryIds: string[] = existingProduct.subSubCategory
        ? Array.isArray(existingProduct.subSubCategory)
          ? (existingProduct.subSubCategory as Array<{ toString(): string }>).map((s) =>
              s.toString(),
            )
          : [(existingProduct.subSubCategory as { toString(): string }).toString()]
        : [];

      const subSubCategoriesChanged =
        JSON.stringify(subSubCategoryIds.sort()) !==
        JSON.stringify(existingSubSubCategoryIds.sort());

      if (subSubCategoriesChanged) {
        for (const subSubCatId of subSubCategoryIds) {
          const subSubCategoryExists = await SubSubCategory.findById(
            subSubCatId,
          );
          if (!subSubCategoryExists) {
            throw new Error(`SubSubCategory with ID ${subSubCatId} not found`);
          }
        }
      }
    }

    if (updateData.colors) {
      const colorIds = Array.isArray(updateData.colors)
        ? updateData.colors
        : [updateData.colors];
      if (colorIds.length === 0) {
        throw new Error("At least one color is required");
      }
      const existingColorIds: string[] = existingProduct.colors
        ? Array.isArray(existingProduct.colors)
          ? (existingProduct.colors as Array<{ toString(): string }>).map((c) => c.toString())
          : [(existingProduct.colors as { toString(): string }).toString()]
        : [];

      const colorsChanged =
        JSON.stringify(colorIds.sort()) !==
        JSON.stringify(existingColorIds.sort());

      if (colorsChanged) {
        for (const colorId of colorIds) {
          const colorExists = await Color.findById(colorId);
          if (!colorExists) {
            throw new Error(`Color with ID ${colorId} not found`);
          }
        }
      }
    }

    // ── Sizes validation (only if field was actually sent) ──
    if (updateData.sizes !== undefined) {
      const sizeIds = Array.isArray(updateData.sizes)
        ? updateData.sizes
        : [updateData.sizes];
      const existingSizeIds: string[] = existingProduct.sizes
        ? Array.isArray(existingProduct.sizes)
          ? (existingProduct.sizes as Array<{ toString(): string }>).map((s) => s.toString())
          : [(existingProduct.sizes as { toString(): string }).toString()]
        : [];

      const sizesChanged =
        JSON.stringify(sizeIds.sort()) !==
        JSON.stringify(existingSizeIds.sort());

      if (sizesChanged) {
        for (const sizeId of sizeIds) {
          const sizeExists = await Size.findById(sizeId);
          if (!sizeExists) {
            throw new Error(`Size with ID ${sizeId} not found`);
          }
        }
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    invalidateProductCaches();response.status(200).json({ _status: true,
      _message: "Product updated successfully",
      _data: updatedProduct,
    });
  } catch (err) {response.status(500).json({ _status: false,
      _message: collectValidationMessages(err),
      _data: null,
    });
  }
};

export const destroy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Try soft-delete first (covers the common case in 1 query instead of 2)
    const softDeleted = await Product.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { deletedAt: new Date() },
      { new: true, projection: { _id: 1 } },
    );

    if (softDeleted) {
      invalidateProductCaches();res.status(200).json({ _status: true,
        _message: "Product deleted successfully",
        _data: null,
      });
      return;
    }

    // Product not found or already soft-deleted → try permanent delete
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {res.status(500).json({ _status: false,
        _message: "Product not found",
        _data: null,
      });
      return;
    }
    invalidateProductCaches();
    res.send({
      _status: true,
      _message: "Product permanently deleted",
      _data: null,
    });
  } catch (err) {
    res.send({
      _status: false,
      _message: "Something went wrong",
      _data: null,
    });
  }
};

export const restore = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ _status: false, _message: "Product ID is required", _data: null });
      return;
    }
    const product = await Product.findByIdAndUpdate(
      id,
      { $set: { deletedAt: null } },
      { new: true, projection: { _id: 1 } },
    );
    if (!product) {
      res.status(404).json({ _status: false, _message: "Product not found", _data: null });
      return;
    }
    invalidateProductCaches();
    res.status(200).json({
      _status: true,
      _message: "Product restored successfully",
      _data: null,
    });
  } catch (err) {
    logger.error(err, "Failed to restore product");
    res.status(500).json({
      _status: false,
      _message: "Failed to restore product",
      _data: null,
    });
  }
};

export const changeStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({
        _status: false,
        _message: "Product not found",
        _data: null,
      });
      return;
    }

    // Cycle through: active → inactive → draft → active
    // Also handles backward-compat with old boolean values (true→active, false→inactive)
    const statusCycle: Array<"active" | "inactive" | "draft"> = ["active", "inactive", "draft"];
    const currentRaw: unknown = product.status;
    const normalized: "active" | "inactive" | "draft" =
      currentRaw === true ? "active" :
      currentRaw === false ? "inactive" :
      typeof currentRaw === "string"
        ? (currentRaw as "active" | "inactive" | "draft")
        : "draft";
    const currentIndex = statusCycle.indexOf(normalized);
    product.status = statusCycle[(currentIndex + 1) % 3]!;
    await product.save();

    invalidateProductCaches();
    res.status(200).json({
      _status: true,
      _message: "Product status changed successfully",
      _data: product,
    });
  } catch (err) {
    res.status(500).json({
      _status: false,
      _message: "Internal Server Error",
      _data: null,
    });
  }
};

export const getByCategory = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const { categoryId, subCategoryId, subSubCategoryId } = request.params;
    const {
      page = "1",
      limit = "20",
      sort = "-createdAt",
    } = request.query as Record<string, string>;

    const cappedLimit = Math.min(Number(limit), 100);

    const categoryIds = Array.isArray(categoryId) ? categoryId : [categoryId];
    const subCategoryIds = Array.isArray(subCategoryId)
      ? subCategoryId
      : [subCategoryId];
    const subSubCategoryIds = Array.isArray(subSubCategoryId)
      ? subSubCategoryId
      : [subSubCategoryId];

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find({
      $or: [
        { category: { $in: categoryIds } },
        { subCategory: { $in: subCategoryIds } },
        { subSubCategory: { $in: subSubCategoryIds } },
      ],
    })
      .populate(POPULATE_PRODUCT)
      .select("name slug image images giftImages price discount_price stock status weight length height breadth purity sizes type sku tags videoUrl category subCategory subSubCategory colors material order createdAt variants")
      .sort(sort)
      .limit(cappedLimit)
      .skip(skip)
      .lean();

    const total = await Product.countDocuments({
      category: { $in: categoryIds },
    });
response.status(200).json({ _status: true,
      _message: "Products fetched successfully",
      _data: products,
      _pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {response.status(500).json({ _status: false,
      _message: "Something went wrong",
      _data: [],
    });
  }
};

export const getProductByFilter = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const {
      limit = 10,
      isFeatured,
      isNewArrival,
      isBestSeller,
      isTopRated,
      isUpsell,
      isOnSale,
      category,
      subCategory,
      subSubCategory,
    } = request.body as Record<string, unknown>;

    const query: Record<string, unknown> = {};

    if (isFeatured !== undefined) query.isFeatured = isFeatured;
    if (isNewArrival !== undefined) query.isNewArrival = isNewArrival;
    if (isBestSeller !== undefined) query.isBestSeller = isBestSeller;
    if (isTopRated !== undefined) query.isTopRated = isTopRated;
    if (isUpsell !== undefined) query.isUpsell = isUpsell;
    if (isOnSale !== undefined) query.isOnSale = isOnSale;

    if (category) {
      query.category = Array.isArray(category) ? { $in: category } : category;
    }
    if (subCategory) {
      query.subCategory = Array.isArray(subCategory)
        ? { $in: subCategory }
        : subCategory;
    }
    if (subSubCategory) {
      query.subSubCategory = Array.isArray(subSubCategory)
        ? { $in: subSubCategory }
        : subSubCategory;
    }

    const products = await Product.find(query)
      .populate(POPULATE_PRODUCT)
      .select("name slug image images giftImages price discount_price stock weight length height breadth purity sizes type sku tags videoUrl category subCategory subSubCategory colors material variants")
      .limit(Math.min(Number(limit), 100))
      .sort("-createdAt")
      .lean();
response.status(200).json({ _status: true,
      _message: "Filtered products fetched successfully",
      _data: products,
    });
  } catch (err) {response.status(500).json({ _status: false,
      _message: "Something went wrong",
      _data: [],
    });
  }
};

export const updateStock = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const { id, stock } = request.body as { id?: string; stock?: unknown };
    const stockVal = Number(stock);
    if (isNaN(stockVal) || stockVal < 0) {
      throw new Error("Stock cannot be negative");
    }
    const product = await Product.findByIdAndUpdate(
      id,
      { stock: stockVal },
      { new: true, runValidators: true },
    );
    if (!product) {
      throw new Error("Product not found");
    }response.status(200).json({ _status: true,
      _message: "Stock updated successfully",
      _data: product,
    });
  } catch (err) {response.status(500).json({ _status: false,
      _message: "Something went wrong",
      _data: null,
    });
  }
};