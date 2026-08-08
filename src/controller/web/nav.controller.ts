import type { Request, Response } from "express";
import mongoose from "mongoose";
import Category from "../../models/category.js";
import SubCategory from "../../models/subCategory.js";
import SubSubCategory from "../../models/subSubCategory.js";
import cache from "../../lib/cache.js";
import { success, fail } from "../../utils/responses.js";

interface NavNode {
  slug?: string;
  status?: boolean;
  deletedAt?: string | null;
  updatedAt?: string | Date;
  subCategories?: NavNode[];
  subSubCategories?: NavNode[];
}

const toMinimal = (nodes: NavNode[]): NavNode[] =>
  nodes.map((node) => ({
    slug: node.slug,
    status: node.status,
    deletedAt: node.deletedAt,
    updatedAt: node.updatedAt,
    ...(node.subCategories ? { subCategories: toMinimal(node.subCategories) } : {}),
    ...(node.subSubCategories ? { subSubCategories: toMinimal(node.subSubCategories) } : {}),
  }));

export const navController = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const minimal = req.query.minimal === "true";
    const cacheKey = "navigationData";
    const cached = minimal ? undefined : (cache.get(cacheKey) as NavNode[] | undefined);
    if (cached) {
      return success(res, cached, "Data fetched successfully");
    }

    const categorySelect = minimal
      ? "slug status deletedAt updatedAt"
      : "_id name slug status deletedAt updatedAt parentSubCategory image bannerId";
    const subCategorySelect = minimal
      ? "slug status deletedAt updatedAt category"
      : "_id name slug status deletedAt updatedAt category image bannerId";
    const subSubCategorySelect = minimal
      ? "slug status deletedAt updatedAt subCategory"
      : "_id name slug status deletedAt updatedAt subCategory image bannerId";

    const [categories, subCategories, subSubCategories] = await Promise.all([
      Category.find({ deletedAt: null, status: true })
        .select(categorySelect)
        .lean(),
      SubCategory.find({ deletedAt: null, status: true })
        .select(subCategorySelect)
        .lean(),
      SubSubCategory.find({ deletedAt: null, status: true })
        .select(subSubCategorySelect)
        .lean(),
    ]);

    const navigationData = categories.map((category) => {
      const categorySubCategories = subCategories
        .filter((subCat) => {
          if (Array.isArray(subCat.category)) {
            return (subCat.category as mongoose.Types.ObjectId[]).some(
              (catId) => catId.toString() === category._id.toString(),
            );
          }
          return (subCat.category as mongoose.Types.ObjectId).toString() === category._id.toString();
        })
        .map((subCat) => {
          const subCatSubSubCategories = subSubCategories.filter((subSubCat) => {
            if (Array.isArray(subSubCat.subCategory)) {
              return (subSubCat.subCategory as mongoose.Types.ObjectId[]).some(
                (subCatId) => subCatId.toString() === subCat._id.toString(),
              );
            }
            return (
              (subSubCat.subCategory as mongoose.Types.ObjectId | undefined)?.toString() === subCat._id.toString()
            );
          });

          return {
            ...subCat,
            subSubCategories: subCatSubSubCategories,
          };
        });

      return {
        ...category,
        subCategories: categorySubCategories,
      };
    });

    if (!minimal) {
      cache.set(cacheKey, navigationData, 3600); // 1 hour — nav structure rarely changes, invalidated on admin CRUD
    }
    return success(
      res,
      minimal ? toMinimal(navigationData as NavNode[]) : navigationData,
      "Data fetched successfully",
    );
  } catch (error) {
    return fail(
      res,
      "Server error",
      500,
    );
  }
};