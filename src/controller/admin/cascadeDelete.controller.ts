import type { Request, Response } from "express";
import type { Model, FilterQuery, UpdateQuery } from "mongoose";
import Product from "../../models/product.js";
import SubCategory from "../../models/subCategory.js";
import SubSubCategory from "../../models/subSubCategory.js";
import HomePage from "../../models/homePage.js";
import cache from "../../lib/cache.js";

/**
 * Relationship map: for each deletable entity type, what other collections
 * might reference it and how to remove those references.
 */
interface CascadeReference {
  model: "Product" | "SubCategory" | "SubSubCategory";
  /** Field path in the referencing collection (MongoDB dot-notation) */
  field: string;
  /** True if field is an array (use $pull), false if single (set to null) */
  isArray: boolean;
  label: string; // human-readable name for the referenced collection
}

const CASCADE_RULES: Record<
  string,
  { label: string; references: CascadeReference[] }
> = {
  colors: {
    label: "Color",
    references: [
      { model: "Product", field: "colors", isArray: true, label: "Products" },
    ],
  },
  materials: {
    label: "Material",
    references: [
      { model: "Product", field: "material", isArray: true, label: "Products" },
    ],
  },
  Categories: {
    label: "Category",
    references: [
      { model: "Product", field: "category", isArray: true, label: "Products" },
      { model: "SubCategory", field: "category", isArray: true, label: "Sub Categories" },
    ],
  },
  SubCategories: {
    label: "Sub Category",
    references: [
      { model: "Product", field: "subCategory", isArray: true, label: "Products" },
      { model: "SubSubCategory", field: "subCategory", isArray: true, label: "Sub Sub Categories" },
    ],
  },
  SubSubCategories: {
    label: "Sub Sub Category",
    references: [
      { model: "Product", field: "subSubCategory", isArray: true, label: "Products" },
    ],
  },
};

/** Cache keys that embed product refs (colors/material/categories) — stale after cascade pulls. */
const PRODUCT_CACHE_KEYS = [
  "newArrivals",
  "trendingProducts",
  "bestSellers",
  "featuredForFooter",
  "tabProducts",
];

/**
 * Minimal surface we need from the referencing models.
 * Mongoose's overloaded updateMany won't structurally assign to a plain
 * interface, so we wrap each model with an adapter that exposes exactly
 * countDocuments + updateMany as Promise-returning methods.
 */
interface CascadeModelLike {
  countDocuments(filter?: object): Promise<number>;
  updateMany(
    filter: object,
    update: object,
  ): Promise<{ modifiedCount?: number }>;
}

function adaptModel<T>(model: Model<T>): CascadeModelLike {
  return {
    countDocuments: (filter) =>
      model.countDocuments(filter as FilterQuery<T>).exec(),
    updateMany: (filter, update) =>
      model
        .updateMany(
          filter as FilterQuery<T>,
          update as UpdateQuery<T>,
        )
        .exec(),
  };
}

const MODELS: Record<string, CascadeModelLike> = {
  Product: adaptModel(Product),
  SubCategory: adaptModel(SubCategory),
  SubSubCategory: adaptModel(SubSubCategory),
};

function getReferencingModel(name: string): CascadeModelLike | undefined {
  return MODELS[name];
}

/** Config keys inside home page sections that can reference cascade-deleted entities. */
const HOME_PAGE_ID_ARRAY_KEYS = [
  "categorySelectedIds",
  "subCategorySelectedIds",
  "subSubCategorySelectedIds",
  "productIds",
];

/** Snapshots ({ _id, ... } objects) saved alongside selected IDs by some section forms. */
const HOME_PAGE_SNAPSHOT_KEYS = ["categoryItems"];

/**
 * Count home page sections that reference the entity id.
 * config is a Mixed type, so we scan in JS (only one home page document exists).
 */
async function countHomePageReferences(entityId: string): Promise<number> {
  const page = await HomePage.findOne({}).lean();
  if (!page || !page.sections?.length) return 0;

  const idStr = String(entityId);
  let count = 0;
  for (const section of page.sections) {
    const cfg = (section.config ?? {}) as Record<string, unknown>;

    // A section is counted once even if it references the entity in multiple
    // places (must match removeHomePageReferences, which increments once per
    // section). Short-circuit after the first match.
    let sectionHasRef = false;

    // ID arrays (categorySelectedIds / subCategorySelectedIds / ... / productIds)
    if (!sectionHasRef) {
      for (const key of HOME_PAGE_ID_ARRAY_KEYS) {
        const arr = cfg[key];
        if (Array.isArray(arr) && arr.some((x) => String(x) === idStr)) {
          sectionHasRef = true;
          break;
        }
      }
    }

    // Snapshot objects ({ _id, ... }) saved by some section forms
    if (!sectionHasRef) {
      for (const key of HOME_PAGE_SNAPSHOT_KEYS) {
        const arr = cfg[key];
        if (
          Array.isArray(arr) &&
          arr.some((x) => {
            const obj = x as { _id?: unknown };
            return obj && String(obj._id ?? "") === idStr;
          })
        ) {
          sectionHasRef = true;
          break;
        }
      }
    }

    // Bento cells reference via sourceId/linkTarget/productId
    if (!sectionHasRef) {
      const cells = cfg.cells;
      if (Array.isArray(cells) && cells.length > 0) {
        sectionHasRef = cells.some((c) => {
          const cell = c as { sourceId?: unknown; linkTarget?: unknown; productId?: unknown };
          return (
            String(cell?.sourceId ?? "") === idStr ||
            String(cell?.linkTarget ?? "") === idStr ||
            String(cell?.productId ?? "") === idStr
          );
        });
      }
    }

    if (sectionHasRef) count++;
  }
  return count;
}

/**
 * Remove the entity id from home page section configs (ID arrays + bento cells).
 * Returns the number of home page sections modified.
 */
async function removeHomePageReferences(entityId: string): Promise<number> {
  const page = await HomePage.findOne({});
  if (!page || !page.sections?.length) return 0;

  const idStr = String(entityId);
  let touched = 0;

  for (const section of page.sections) {
    const cfg = (section.config ?? {}) as Record<string, unknown>;
    let sectionChanged = false;

    // Pull the id out of every ID-array key
    for (const key of HOME_PAGE_ID_ARRAY_KEYS) {
      const arr = cfg[key];
      if (!Array.isArray(arr)) continue;
      const filtered = arr.filter((x) => String(x) !== idStr);
      if (filtered.length !== arr.length) {
        cfg[key] = filtered;
        sectionChanged = true;
      }
    }

    // Drop snapshot objects ({ _id, ... }) that reference the entity
    for (const key of HOME_PAGE_SNAPSHOT_KEYS) {
      const arr = cfg[key];
      if (!Array.isArray(arr)) continue;
      const filtered = arr.filter((x) => {
        const obj = x as { _id?: unknown };
        return !obj || String(obj._id ?? "") !== idStr;
      });
      if (filtered.length !== arr.length) {
        cfg[key] = filtered;
        sectionChanged = true;
      }
    }

    // Bento cells: clear sourceId/linkTarget/productId when they point at the entity
    const cells = cfg.cells;
    if (Array.isArray(cells) && cells.length > 0) {
      for (const cell of cells) {
        const c = cell as {
          sourceId?: unknown;
          linkTarget?: unknown;
          productId?: unknown;
        };
        if (String(c?.sourceId ?? "") === idStr) {
          c.sourceId = undefined;
          sectionChanged = true;
        }
        if (String(c?.linkTarget ?? "") === idStr) {
          c.linkTarget = undefined;
          sectionChanged = true;
        }
        if (String(c?.productId ?? "") === idStr) {
          c.productId = undefined;
          sectionChanged = true;
        }
      }
    }

    if (sectionChanged) touched++;
  }

  if (touched > 0) {
    page.markModified("sections");
    await page.save();
  }
  return touched;
}

async function countReferences(
  entityModel: string,
  entityId: string,
): Promise<{ model: string; field: string; count: number; label: string }[]> {
  const rules = CASCADE_RULES[entityModel];
  if (!rules) return [];

  const results = await Promise.all(
    rules.references.map(async (ref) => {
      const Model = getReferencingModel(ref.model);
      if (!Model) return { model: ref.model, field: ref.field, count: 0, label: ref.label };

      const count = await Model.countDocuments({
        [ref.field]: entityId,
        deletedAt: null,
      });
      return { model: ref.model, field: ref.field, count, label: ref.label };
    }),
  );

  return results.filter((r) => r.count > 0);
}

async function removeReferences(
  entityModel: string,
  entityId: string,
): Promise<{ model: string; field: string; removed: number; label: string }[]> {
  const rules = CASCADE_RULES[entityModel];
  if (!rules) return [];

  const results = await Promise.all(
    rules.references.map(async (ref) => {
      const Model = getReferencingModel(ref.model);
      if (!Model) return { model: ref.model, field: ref.field, removed: 0, label: ref.label };

      let result: { modifiedCount?: number } = { modifiedCount: 0 };
      if (ref.isArray) {
        // Remove the ID from the array — pull it out
        result = await Model.updateMany(
          { [ref.field]: entityId, deletedAt: null },
          { $pull: { [ref.field]: entityId } },
        );
      } else {
        // Single-value reference — clear it
        result = await Model.updateMany(
          { [ref.field]: entityId, deletedAt: null },
          { $set: { [ref.field]: null } },
        );
      }

      return {
        model: ref.model,
        field: ref.field,
        removed: result.modifiedCount ?? 0,
        label: ref.label,
      };
    }),
  );

  return results;
}

// ── API Handlers ──

/**
 * POST /api/admin/utils/cascade-delete-preview
 * Body: { model: string, id: string }
 * Returns: { affected: { label: string; count: number }[], total: number }
 */
export const preview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { model, id } = req.body as { model?: string; id?: string };
    if (!model || !id) {
      res.status(400).json({ _status: false, _message: "model and id are required", _data: null });
      return;
    }

    const rules = CASCADE_RULES[model];
    if (!rules) {
      res.status(400).json({ _status: false, _message: `Unknown model: ${model}`, _data: null });
      return;
    }

    const references = await countReferences(model, id);
    const homePageCount = await countHomePageReferences(id);
    if (homePageCount > 0) {
      references.push({ model: "HomePage", field: "sections.config", count: homePageCount, label: "Home Page Sections" });
    }
    const total = references.reduce((sum, r) => sum + r.count, 0);

    res.json({
      _status: true,
      _message: "Preview generated",
      _data: {
        label: rules.label,
        references: references.map((r) => ({ label: r.label, count: r.count })),
        total,
      },
    });
  } catch (err) {
    res.status(500).json({ _status: false, _message: "Failed to generate preview", _data: null });
  }
};

/**
 * POST /api/admin/utils/cascade-delete-execute
 * Body: { model: string, id: string }
 * Returns: { removed: { label: string; removed: number }[], message: string }
 */
export const execute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { model, id } = req.body as { model?: string; id?: string };
    if (!model || !id) {
      res.status(400).json({ _status: false, _message: "model and id are required", _data: null });
      return;
    }

    const rules = CASCADE_RULES[model];
    if (!rules) {
      res.status(400).json({ _status: false, _message: `Unknown model: ${model}`, _data: null });
      return;
    }

    // 1. Remove references
    const removed = await removeReferences(model, id);
    const homePageRemoved = await removeHomePageReferences(id);
    if (homePageRemoved > 0) {
      removed.push({ model: "HomePage", field: "sections.config", removed: homePageRemoved, label: "Home Page Sections" });
    }
    const totalRemoved = removed.reduce((sum, r) => sum + r.removed, 0);

    // 2. Soft-delete the entity itself
    // The actual controller handles this, but we just return what we cleaned up
    // The frontend will then call the normal delete endpoint

    // Invalidate relevant caches
    cache.del("navigationData");
    cache.del("homePage");
    for (const key of PRODUCT_CACHE_KEYS) cache.del(key);

    res.json({
      _status: true,
      _message: `References cleaned up from ${totalRemoved} record(s)`,
      _data: {
        removed: removed.map((r) => ({ label: r.label, removed: r.removed })),
        total: totalRemoved,
      },
    });
  } catch (err) {
    res.status(500).json({ _status: false, _message: "Failed to execute cascade delete", _data: null });
  }
};
