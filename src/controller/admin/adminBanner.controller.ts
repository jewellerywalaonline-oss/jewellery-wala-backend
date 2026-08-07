import type { Request, Response } from "express";
import type { FilterQuery } from "mongoose";
import bannerModal from "../../models/banner.js";
import Product from "../../models/product.js";
import Category from "../../models/category.js";
import SubCategory from "../../models/subCategory.js";
import SubSubCategory from "../../models/subSubCategory.js";
import { uploadToR2 } from "../../lib/cloudflare.js";
import { resolveBannerLink } from "../../lib/bannerUrl.js";
import cache from "../../lib/cache.js";

export const createBanner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = req.body as Record<string, unknown>;

    // Parse link field from body (sent as JSON string in FormData)
    if (req.body.link) {
      try {
        const linkInput = typeof req.body.link === "string" ? JSON.parse(req.body.link) : req.body.link;
        const { url, label } = await resolveBannerLink(linkInput);
        data.link = { ...linkInput, url, label };
      } catch {
        // Invalid link — create banner without link
        delete data.link;
      }
    }

    const bannerName = (data.title as string) || (data.description as string) || undefined;

    if (req.file) {
      const uploadResult = await uploadToR2(req.file, "banners", 85, bannerName);
      if (uploadResult.success) {
        data.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const banner = await bannerModal.create(data);
    cache.del("bannerData");
    res.status(201).json({
      _status: true,
      _message: "Banner Created Successfully",
      _data: banner,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to create banner",
      _data: null,
    });
  }
};

export const getAllBanner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    let pageValue = 1;
    let limitValue = 10;
    let skipValue: number;

    const andCondition: Record<string, unknown>[] = [];
    const orCondition: Record<string, unknown>[] = [];

    const isDeletedAt = req.body?.isDeletedAt ?? req.query?.isDeletedAt;
    if (isDeletedAt === "all") {
      // No deletedAt filter — show all
    } else if (isDeletedAt === "deleted") {
      andCondition.push({ deletedAt: { $ne: null } });
    } else {
      // Default: active (non-deleted) only
      andCondition.push({ deletedAt: null });
    }

    const filter: Record<string, unknown> = {};
    if (andCondition.length > 0) {
      filter.$and = andCondition;
    }

    if (req.body != undefined) {
      pageValue = req.body.page ?? 1;
      limitValue = Math.min(req.body.limit ?? 10, 100);
      skipValue = (pageValue - 1) * limitValue;

      if (req.body.description != undefined) {
        const description = new RegExp(req.body.description, "i");
        orCondition.push({ description } as Record<string, unknown>);
      }
      if (req.body.status != undefined) {
        andCondition.push({ status: req.body.status });
      }
    } else {
      skipValue = 0;
    }

    if (orCondition.length > 0) {
      filter.$or = orCondition;
    }

    const totalRecords = await bannerModal.countDocuments(filter as FilterQuery<typeof bannerModal>);
    const banner = await bannerModal
      .find(filter as FilterQuery<typeof bannerModal>)
      .sort({ order: "asc", _id: "desc" })
      .limit(limitValue)
      .skip(skipValue);

    res.status(200).json({
      _status: true,
      _message: "Banners Found",
      _data: banner,
      _total_pages: Math.ceil(totalRecords / limitValue),
      _total_records: totalRecords,
      _current_page: Number(pageValue),
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to fetch banners",
      _data: null,
    });
  }
};

export const updateBanner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = req.body as Record<string, unknown>;

    // Handle link field update
    if (req.body.link !== undefined) {
      if (req.body.link === "null" || req.body.link === null) {
        data.link = null;
      } else {
        try {
          const linkInput = typeof req.body.link === "string" ? JSON.parse(req.body.link) : req.body.link;
          const { url, label } = await resolveBannerLink(linkInput);
          data.link = { ...linkInput, url, label };
        } catch {
          // Invalid link — keep existing link
          delete data.link;
        }
      }
    }

    const bannerName = (data.title as string) || (data.description as string) || undefined;

    if (req.file) {
      const uploadResult = await uploadToR2(req.file, "banners", 85, bannerName);
      if (uploadResult.success) {
        data.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const banner = await bannerModal.findByIdAndUpdate(
      req.params.id,
      { $set: data },
      { new: true },
    );

    cache.del("bannerData");
    res.status(200).json({
      _status: !!banner,
      _message: banner ? "Banner Updated Successfully" : "Banner Not Found",
      _data: banner,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to update banner",
      _data: null,
    });
  }
};

export const deleteBanner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const existing = await bannerModal.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ _status: false, _message: "Banner Not Found", _data: null });
      return;
    }
    if (existing.deletedAt) {
      // Already soft-deleted → permanently delete
      await bannerModal.findByIdAndDelete(req.params.id);
      cache.del("bannerData");
      res.status(200).json({ _status: true, _message: "Banner Permanently Deleted", _data: null });
      return;
    }
    await bannerModal.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date() },
      { new: true },
    );
    cache.del("bannerData");
    res.status(200).json({
      _status: true,
      _message: "Banner Deleted Successfully",
      _data: null,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to delete banner",
      _data: null,
    });
  }
};

// ── Link options endpoints ────────────────────────────────────────

export const linkOptionsProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string) || "";
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const filter: Record<string, unknown> = { deletedAt: null, status: true };
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { slug: new RegExp(search, "i") },
      ];
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .select("_id name slug")
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      _status: true,
      _data: products,
      _total_pages: Math.ceil(total / limit),
      _total_records: total,
    });
  } catch (err) {
    res.status(500).json({ _status: false, _message: "Failed to fetch products", _data: [] });
  }
};

export const linkOptionsCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find({ deletedAt: null, status: true })
      .select("_id name slug")
      .sort({ name: 1 })
      .lean();

    res.json({ _status: true, _data: categories });
  } catch (err) {
    res.status(500).json({ _status: false, _message: "Failed to fetch categories", _data: [] });
  }
};

export const linkOptionsSubCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = req.query.categoryId as string;
    const filter: Record<string, unknown> = { deletedAt: null, status: true };
    if (categoryId) filter.category = categoryId;

    const subCategories = await SubCategory.find(filter)
      .select("_id name slug category")
      .populate("category", "slug")
      .sort({ name: 1 })
      .lean();

    res.json({ _status: true, _data: subCategories });
  } catch (err) {
    res.status(500).json({ _status: false, _message: "Failed to fetch sub categories", _data: [] });
  }
};

export const linkOptionsSubSubCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const subCategoryId = req.query.subCategoryId as string;
    const filter: Record<string, unknown> = { deletedAt: null, status: true };
    if (subCategoryId) filter.subCategory = subCategoryId;

    const subSubCategories = await SubSubCategory.find(filter)
      .select("_id name slug subCategory")
      .populate({
        path: "subCategory",
        select: "slug category",
        populate: { path: "category", select: "slug" },
      })
      .sort({ name: 1 })
      .lean();

    res.json({ _status: true, _data: subSubCategories });
  } catch (err) {
    res.status(500).json({ _status: false, _message: "Failed to fetch sub sub categories", _data: [] });
  }
};

export const restore = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ _status: false, _message: "Banner ID is required", _data: null });
      return;
    }
    await bannerModal.updateOne(
      { _id: id },
      { $set: { deletedAt: null } },
    );
    cache.del("bannerData");
    res.status(200).json({
      _status: true,
      _message: "Banner restored successfully",
      _data: null,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to restore banner",
      _data: null,
    });
  }
};

export const changeStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const banner = await bannerModal.updateMany(
      { _id: req.body.id },
      [{ $set: { status: { $not: "$status" } } }],
    );
    cache.del("bannerData");
    res.status(200).json({
      _status: true,
      _message: "Status Changed Successfully",
      _data: banner,
    });
  } catch (error) {
    res.status(500).json({
      _status: false,
      _message: "Failed to change status",
      _data: null,
    });
  }
};
