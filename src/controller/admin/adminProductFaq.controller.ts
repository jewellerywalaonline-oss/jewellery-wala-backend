import type { Request, Response } from "express";
import type { FilterQuery } from "mongoose";
import productFaq from "../../models/productFaq.js";
import cache from "../../lib/cache.js";
import { success, fail } from "../../utils/responses.js";

const invalidateCache = () => {
  cache.del("productFaqs");
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const { products, entries, status } = req.body as {
      products: string[];
      entries: { question: string; answer: string; order?: number }[];
      status?: boolean;
    };

    if (!products || !Array.isArray(products) || products.length === 0) {
      fail(res, "At least one product is required", 400);
      return;
    }

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      fail(res, "At least one FAQ entry is required", 400);
      return;
    }

    for (const [i, entry] of entries.entries()) {
      if (!entry.question?.trim() || !entry.answer?.trim()) {
        fail(res, `FAQ entry ${i + 1} has empty question or answer`, 400);
        return;
      }
    }

    const doc = await productFaq.create({
      products,
      entries: entries.map((e) => ({
        question: e.question.trim(),
        answer: e.answer.trim(),
        order: e.order ?? 1,
      })),
      status: status ?? true,
    });

    invalidateCache();
    success(res, doc, "Product FAQ set created", 201);
  } catch (err) {
    fail(res, err instanceof Error ? err.message : "Failed to create", 500);
  }
};

export const view = async (req: Request, res: Response): Promise<void> => {
  try {
    const andCondition: Record<string, unknown>[] = [];
    const orCondition: Record<string, unknown>[] = [];
    const filter: Record<string, unknown> = {};

    const isDeletedAt = req.body?.isDeletedAt ?? req.query?.isDeletedAt;
    if (isDeletedAt === "all") {
      // No deletedAt filter — show all
    } else if (isDeletedAt === "deleted") {
      andCondition.push({ deletedAt: { $ne: null } });
    } else {
      // Default: active (non-deleted) only
      andCondition.push({ deletedAt: null });
    }

    if (andCondition.length > 0) filter.$and = andCondition;

    const pageValue = req.body.page ?? 1;
    const limitValue = Math.min(req.body.limit ?? 10, 100);
    const skipValue = (pageValue - 1) * limitValue;

    if (req.body.question) {
      orCondition.push({ "entries.question": new RegExp(req.body.question, "i") });
    }
    if (req.body.status !== undefined) {
      andCondition.push({ status: req.body.status });
    }
    if (req.body.product) {
      andCondition.push({ products: req.body.product });
    }
    if (orCondition.length > 0) filter.$or = orCondition;

    const totalRecords = await productFaq.countDocuments(filter as FilterQuery<typeof productFaq>);
    const data = await productFaq
      .find(filter as FilterQuery<typeof productFaq>)
      .select("_id products entries status createdAt")
      .sort({ createdAt: "desc", _id: "desc" })
      .limit(limitValue)
      .skip(skipValue)
      .populate("products", "name slug")
      .lean();

    res.json({
      _status: true,
      _message: "FAQ Sets Found",
      _data: data,
      _total_pages: Math.ceil(totalRecords / limitValue),
      _total_records: totalRecords,
      _current_page: Number(pageValue),
    });
  } catch (err) {
    fail(res, "Failed to fetch FAQ sets", 500);
  }
};

export const details = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await productFaq
      .findById(req.body.id)
      .populate("products", "name slug")
      .lean();
    success(res, result, result ? "FAQ Set Found" : "No FAQ Set Found");
  } catch (err) {
    fail(res, "Failed to fetch FAQ set details", 500);
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const updateData: Record<string, unknown> = {};
    if (req.body.products !== undefined) updateData.products = req.body.products;
    if (req.body.entries !== undefined) {
      for (const [i, entry] of req.body.entries.entries()) {
        if (!entry.question?.trim() || !entry.answer?.trim()) {
          fail(res, `FAQ entry ${i + 1} has empty question or answer`, 400);
          return;
        }
      }
      updateData.entries = req.body.entries.map((e: { question: string; answer: string; order?: number }) => ({
        question: e.question.trim(),
        answer: e.answer.trim(),
        order: e.order ?? 1,
      }));
    }
    if (req.body.status !== undefined) updateData.status = req.body.status;

    const result = await productFaq.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true },
    );
    invalidateCache();
    success(res, result, result ? "FAQ Set Updated" : "FAQ Set Not Found");
  } catch (err) {
    fail(res, "Failed to update product FAQ", 500);
  }
};

export const destroy = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await productFaq.findById(req.params.id).select("_id deletedAt").lean();
    if (!existing) {
      fail(res, "FAQ Set Not Found", 404);
      return;
    }
    if (existing.deletedAt) {
      // Already soft-deleted → permanently delete
      await productFaq.findByIdAndDelete(req.params.id);
      invalidateCache();
      success(res, null, "FAQ Set Permanently Deleted");
      return;
    }
    await productFaq.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date() },
      { new: true },
    );
    invalidateCache();
    success(res, null, "FAQ Set Deleted");
  } catch (err) {
    fail(res, "Failed to delete product FAQ", 500);
  }
};

export const restore = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      fail(res, "FAQ Set ID is required", 400);
      return;
    }
    await productFaq.updateOne(
      { _id: id },
      { $set: { deletedAt: null } },
    );
    invalidateCache();
    success(res, null, "FAQ Set restored successfully");
  } catch (err) {
    fail(res, "Failed to restore FAQ set", 500);
  }
};

export const changeStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await productFaq.updateMany(
      { _id: req.body.id },
      [{ $set: { status: { $not: "$status" } } }],
    );
    invalidateCache();
    success(res, result, "Status Changed");
  } catch (err) {
    fail(res, "Failed to change status", 500);
  }
};
