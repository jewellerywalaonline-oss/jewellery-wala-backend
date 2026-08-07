import type { Request, Response } from "express";
import productModel from "../../models/product.js";
import category from "../../models/category.js";
import subCategory from "../../models/subCategory.js";
import subSubCategory from "../../models/subSubCategory.js";
import { success, fail } from "../../utils/responses.js";

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const isDeletedAt = (req.query?.isDeletedAt as string | undefined) ?? "active";
    let query: Record<string, unknown> = { status: true };
    if (isDeletedAt === "active") {
      query.deletedAt = null;
    } else if (isDeletedAt === "deleted") {
      query.deletedAt = { $ne: null };
    }
    // isDeletedAt === "all" — no deletedAt filter, show everything

    const data = await productModel
      .find(query)
      .select("_id name slug")
      .sort({ name: 1 })
      .lean();
    success(res, data, "Products fetched");
  } catch (err) {
    fail(res, "Internal Server Error", 500);
  }
};

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const isDeletedAt = (req.query?.isDeletedAt as string | undefined) ?? "active";
    let query: Record<string, unknown> = { status: true };
    if (isDeletedAt === "active") {
      query.deletedAt = null;
    } else if (isDeletedAt === "deleted") {
      query.deletedAt = { $ne: null };
    }
    // isDeletedAt === "all" — no deletedAt filter, show everything

    const data = await category
      .find(query)
      .select("_id name slug")
      .sort({ name: 1 })
      .lean();
    success(res, data, "Categories fetched");
  } catch (err) {
    fail(res, "Internal Server Error", 500);
  }
};

export const getSubCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await subCategory
      .find({ deletedAt: null, status: true })
      .select("_id name slug")
      .sort({ name: 1 })
      .lean();
    success(res, data, "Sub-categories fetched");
  } catch (err) {
    fail(res, "Internal Server Error", 500);
  }
};

export const getSubSubCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await subSubCategory
      .find({ deletedAt: null, status: true })
      .select("_id name slug")
      .sort({ name: 1 })
      .lean();
    success(res, data, "Sub-sub-categories fetched");
  } catch (err) {
    fail(res, "Internal Server Error", 500);
  }
};
