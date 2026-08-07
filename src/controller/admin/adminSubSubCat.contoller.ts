import type { Request, Response } from "express";
import { generateUniqueSlug } from "../../lib/slugFunc.js";
import subSubCategory from "../../models/subSubCategory.js";
import { uploadToR2 } from "../../lib/cloudflare.js";
import cache from "../../lib/cache.js";

export const create = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const subSubCatDoc = new subSubCategory(request.body);

    const subSubCatName = request.body?.name as string | undefined;

    if (request.file) {
      const uploadResult = await uploadToR2(request.file, "subsubcategories", 80, subSubCatName);
      if (uploadResult.success) {
        subSubCatDoc.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const slug = await generateUniqueSlug(subSubCategory, subSubCatDoc.name);
    subSubCatDoc.slug = slug;

    const ress = await subSubCatDoc.save();
    cache.del("navigationData");
    response.send({
      _status: true,
      _message: "Sub-sub-category created successfully",
      _data: ress,
    });
  } catch (err) {
    const messages: string[] = [];
    if (err instanceof Error && "errors" in err) {
      const errors = (err as Record<string, unknown>).errors as Record<string, { message: string }> | undefined;
      if (errors) {
        for (const msg in errors) {
          if (errors[msg]?.message) {
            messages.push(errors[msg].message);
          }
        }
      }
    } else if (err instanceof Error) {
      messages.push(err.message);
    } else {
      messages.push("Something went wrong");
    }
    response.status(500).json({ _status: false, _message: messages, _data: [] });
  }
};

export const view = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const andCondition: Record<string, unknown>[] = [];
    const orCondition: Record<string, unknown>[] = [];

    const isDeletedAt = request.body?.isDeletedAt ?? request.query?.isDeletedAt;
    if (isDeletedAt === "all") {
      // No deletedAt filter — show all
    } else if (isDeletedAt === "deleted") {
      andCondition.push({ deletedAt: { $ne: null } });
    } else {
      // Default: active (non-deleted) only
      andCondition.push({ deletedAt: null });
    }

    const filter: Record<string, unknown> = {};
    if (andCondition.length > 0) filter.$and = andCondition;

    if (request.body != undefined) {
      if (request.body.name != undefined) {
        const name = new RegExp(request.body.name, "i");
        orCondition.push({ name });
      }
      if (request.body.status != undefined) {
        andCondition.push({ status: request.body.status });
      }
      if (request.body.sub_category_id) {
        andCondition.push({
          subCategory_ids: {
            $in: Array.isArray(request.body.sub_category_id)
              ? request.body.sub_category_id
              : [request.body.sub_category_id],
          },
        });
      }
    }
    if (orCondition.length > 0) filter.$or = orCondition;

    const ress = await subSubCategory
      .find(filter)
      .sort({ order: "asc", _id: "desc" })
      .populate({
        path: "subCategory",
        populate: { path: "category", select: "slug name" },
      })
      .lean();

    response.send({
      _status: true,
      _message: "Sub-sub-categories found",
      _data: ress,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to fetch sub-sub-categories",
      _data: null,
    });
  }
};

export const destroy = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    // Route is /delete/:id — id comes from the URL param.
    const id = request.params.id;
    const existing = await subSubCategory.findById(id).select("_id deletedAt").lean();
    if (!existing) {
      response.status(500).json({ _status: false, _message: "Sub-sub-category not found", _data: null });
      return;
    }
    if (existing.deletedAt) {
      // Already soft-deleted → permanently delete
      await subSubCategory.findByIdAndDelete(id);
      cache.del("navigationData");
      response.status(200).json({ _status: true, _message: "Sub-sub-category permanently deleted", _data: null });
      return;
    }
    await subSubCategory.updateOne(
      { _id: id },
      { $set: { deletedAt: new Date() } },
    );
    cache.del("navigationData");
    response.send({
      _status: true,
      _message: "Sub-sub-category deleted",
      _data: null,
    });
  } catch (err) {
    cache.del("navigationData");
    response.send({
      _status: false,
      _message: "Failed to delete sub-sub-category",
      _data: null,
    });
  }
};

export const details = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    // Route is /details/:id — id comes from the URL param.
    const result = await subSubCategory
      .findById({ _id: request.params.id })
      .lean();
    response.send({
      _status: !!result,
      _message: result ? "Sub-sub-category found" : "Sub-sub-category not found",
      _data: result,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to fetch sub-sub-category details",
      _data: null,
    });
  }
};

export const update = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const id = request.params.id;
    const updateData: Record<string, unknown> = { ...request.body };

    const subSubCatName = updateData.name as string | undefined;

    if (request.file) {
      const uploadResult = await uploadToR2(request.file, "subsubcategories", 80, subSubCatName);
      if (uploadResult.success) {
        updateData.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    if (updateData.name) {
      const slug = await generateUniqueSlug(subSubCategory, updateData.name as string);
      updateData.slug = slug;
    }

    const ress = await subSubCategory.updateOne({ _id: id }, { $set: updateData });
    cache.del("navigationData");
    response.send({
      _status: true,
      _message: "Sub-sub-category updated",
      _data: ress,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to update sub-sub-category",
      _data: null,
    });
  }
};

export const restore = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const { id } = request.params;
    if (!id) {
      response.status(400).json({ _status: false, _message: "Sub-sub-category ID is required", _data: null });
      return;
    }
    await subSubCategory.updateOne(
      { _id: id },
      { $set: { deletedAt: null } },
    );
    response.status(200).json({
      _status: true,
      _message: "Sub-sub-category restored successfully",
      _data: null,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to restore sub-sub-category",
      _data: null,
    });
  }
};

export const changeStatus = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    // Route is /change-status/:id — id comes from the URL param.
    const result = await subSubCategory.updateMany(
      { _id: request.params.id },
      [{ $set: { status: { $not: "$status" } } }],
    );
    cache.del("navigationData");
    response.send({
      _status: true,
      _message: "Sub-sub-category status changed",
      _data: result,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to change sub-sub-category status",
      _data: null,
    });
  }
};