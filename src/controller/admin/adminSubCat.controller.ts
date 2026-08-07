import type { Request, Response } from "express";
import { generateUniqueSlug } from "../../lib/slugFunc.js";
import subCategory from "../../models/subCategory.js";
import { uploadToR2 } from "../../lib/cloudflare.js";
import cache from "../../lib/cache.js";

export const create = async (
  request: Request,
  response: Response,
): Promise<void> => {
  try {
    const subCatDoc = new subCategory(request.body);

    const subCatName = request.body?.name as string | undefined;

    if (request.file) {
      const uploadResult = await uploadToR2(request.file, "subcategories", 80, subCatName);
      if (uploadResult.success) {
        subCatDoc.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    const slug = await generateUniqueSlug(subCategory, subCatDoc.name);
    subCatDoc.slug = slug;

    const ress = await subCatDoc.save();
    cache.del("navigationData");
    cache.del("subCategory_men");
    cache.del("subCategory_women");
    response.send({
      _status: true,
      _message: "Sub-category created successfully",
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
      if (request.body.parent_category_id) {
        andCondition.push({
          parent_category_ids: {
            $in: Array.isArray(request.body.parent_category_id)
              ? request.body.parent_category_id
              : [request.body.parent_category_id],
          },
        });
      }
    }
    if (orCondition.length > 0) filter.$or = orCondition;

    const ress = await subCategory
      .find(filter)
      .select("_id name slug image category status order")
      .sort({ order: "asc", _id: "desc" })
      .populate("category", "name slug")
      .lean();

    response.send({
      _status: true,
      _message: "Sub-categories found",
      _data: ress,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to fetch sub-categories",
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
    const existing = await subCategory.findById(id).select("_id deletedAt").lean();
    if (!existing) {
      response.status(500).json({ _status: false, _message: "Sub-category not found", _data: null });
      return;
    }
    if (existing.deletedAt) {
      // Already soft-deleted → permanently delete
      await subCategory.findByIdAndDelete(id);
      cache.del("navigationData");
      cache.del("subCategory_men");
      cache.del("subCategory_women");
      response.status(200).json({ _status: true, _message: "Sub-category permanently deleted", _data: null });
      return;
    }
    await subCategory.updateOne(
      { _id: id },
      { $set: { deletedAt: new Date() } },
    );
    cache.del("navigationData");
    cache.del("subCategory_men");
    cache.del("subCategory_women");
    response.send({
      _status: true,
      _message: "Sub-category deleted",
      _data: null,
    });
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to delete sub-category",
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
    const result = await subCategory.findById({ _id: request.params.id }).lean();
    if (result) {
      response.status(200).json({
        _status: true,
        _message: "Sub-category found",
        _data: result,
      });
    } else {
      response.status(404).json({
        _status: false,
        _message: "Sub-category not found",
        _data: null,
      });
    }
  } catch (err) {
    response.send({
      _status: false,
      _message: "Failed to fetch sub-category details",
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

    const subCatName = updateData.name as string | undefined;

    if (request.file) {
      const uploadResult = await uploadToR2(request.file, "subcategories", 80, subCatName);
      if (uploadResult.success) {
        updateData.image = uploadResult.url;
      } else {
        throw new Error("Failed to upload image");
      }
    }

    if (updateData.name) {
      const slug = await generateUniqueSlug(subCategory, updateData.name as string);
      updateData.slug = slug;
    }

    const ress = await subCategory.updateOne({ _id: id }, { $set: updateData });

    cache.del("navigationData");
    cache.del("subCategory_men");
    cache.del("subCategory_women");
    response.send({
      _status: true,
      _message: "Sub-category updated",
      _data: ress,
    });
  } catch (err) {
    cache.del("navigationData");
    response.send({
      _status: false,
      _message: "Failed to update sub-category",
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
      response.status(400).json({ _status: false, _message: "Sub-category ID is required", _data: null });
      return;
    }
    await subCategory.updateOne(
      { _id: id },
      { $set: { deletedAt: null } },
    );
    response.status(200).json({
      _status: true,
      _message: "Sub-category restored successfully",
      _data: null,
    });
  } catch (err) {
    response.status(500).json({
      _status: false,
      _message: "Failed to restore sub-category",
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
    const result = await subCategory.updateMany(
      { _id: request.params.id },
      [{ $set: { status: { $not: "$status" } } }],
    );

    cache.del("navigationData");
    cache.del("subCategory_men");
    cache.del("subCategory_women");
    response.send({
      _status: true,
      _message: "Sub-category status changed",
      _data: result,
    });
  } catch (err) {
    cache.del("navigationData");
    response.send({
      _status: false,
      _message: "Failed to change sub-category status",
      _data: null,
    });
  }
};