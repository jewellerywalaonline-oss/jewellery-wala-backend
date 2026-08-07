import type { Request, Response } from "express";
import homePage from "../../models/homePage.js";
import cache from "../../lib/cache.js";
import { success, fail } from "../../utils/responses.js";

const CACHE_KEY = "homePage";

// ── Section type config schemas ───────────────────────────────────────
// Each type lists required fields and their expected types.
// `additionalFields: false` means the config must not contain unknown keys.

interface ConfigField {
  type: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  /** For array types, the expected item shape */
  itemShape?: Record<string, ConfigField>;
}

type SectionSchema = Record<string, ConfigField>;

const SECTION_SCHEMAS: Record<string, { fields: SectionSchema; titleRequired?: boolean }> = {
  // ── Banner slider / single banner ──
  // NEW format: selectedBannerIds, bannerMode, bannerSearch
  // LEGACY format: image, link, title, subtitle, buttonText  (accepted for backward compat)
  // ── Banner slider / single banner ──
  // Form saves: bannerMode, selectedBannerIds (string[]), bannerSearch
  "banner": {
    fields: {
      selectedBannerIds: { type: "array", required: true },
      bannerMode: { type: "string" },
      bannerSearch: { type: "string" },
    },
  },
  // ── Round / Square / Shop-by-Price categories ──
  // Form saves: heading (string)
  "round-categories": {
    fields: {
      heading: { type: "string" },
    },
  },
  "square-categories": {
    fields: {
      heading: { type: "string" },
    },
  },
  // ── Category grid with source-type selector ──
  // Form saves: heading, categorySourceType, categorySelectedIds, categoryItems, categorySearch
  "category-grid": {
    fields: {
      heading: { type: "string" },
      categorySourceType: { type: "string" },
      categorySelectedIds: { type: "array", required: true },
      categoryItems: { type: "array" },
      categorySearch: { type: "string" },
    },
  },
  // ── Product slider ──
  // Form saves: heading, productSource, limit
  "product-slider": {
    fields: {
      heading: { type: "string" },
      productSource: { type: "string" },
      limit: { type: "string" },
    },
  },
  // ── Products tab ──
  // Form saves: heading, searchTerms
  "products-tab": {
    fields: {
      heading: { type: "string" },
      searchTerms: { type: "string" },
    },
  },
  // ── Shop by Price ──
  // Form saves: heading, ranges
  "shop-by-price": {
    fields: {
      heading: { type: "string" },
      ranges: {
        type: "array",
        required: true,
        itemShape: {
          label: { type: "string", required: true },
          min: { type: "number", required: true },
          max: { type: "number", required: true },
        },
      },
    },
  },
  // ── DB-driven sections (no config needed) ──
  "why-choose-us": {
    fields: {},
  },
  "testimonial": {
    fields: {},
  },
  // ── Promo banner ──
  // Form saves: heading, buttonText, selectedBannerId, bannerImage, bannerLinkData, bannerSearch
  "promo-banner": {
    fields: {
      heading: { type: "string" },
      buttonText: { type: "string" },
      selectedBannerId: { type: "string", required: true },
      bannerImage: { type: "string" },
      bannerSearch: { type: "string" },
    },
  },
  // ── Video section ──
  // Form saves: heading, subtitle, buttonText, videoUrl, selectedBannerId, bannerLinkData, bannerSearch
  "video": {
    fields: {
      heading: { type: "string" },
      subtitle: { type: "string" },
      buttonText: { type: "string" },
      videoUrl: { type: "string", required: true },
      selectedBannerId: { type: "string" },
      bannerSearch: { type: "string" },
    },
  },
  // ── Bento grid ──
  // Form saves: heading, layout, cells[ { image, title, subtitle, linkType, linkTarget, sourceType, sourceId } ]
  "bento-grid": {
    fields: {
      heading: { type: "string" },
      layout: { type: "string" },
      cells: {
        type: "array",
        required: true,
        itemShape: {
          image: { type: "string", required: true },
          title: { type: "string" },
          subtitle: { type: "string" },
          linkType: { type: "string" },
          linkTarget: { type: "string" },
          sourceType: { type: "string" },
          sourceId: { type: "string" },
        },
      },
    },
  },
  // ── Custom HTML ──
  "custom": {
    fields: {},
  },
};

/**
 * Validate a section's config against its type schema.
 * Returns an array of error messages (empty = valid).
 */
function validateSectionConfig(
  type: string,
  config: Record<string, unknown> | undefined,
): string[] {
  const errors: string[] = [];
  const schema = SECTION_SCHEMAS[type];

  if (!schema) {
    errors.push(`Unknown section type: "${type}"`);
    return errors;
  }

  // Skip validation for types with no fields
  if (Object.keys(schema.fields).length === 0) return errors;

  const cfg = config ?? {};

  for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
    const value = cfg[fieldName];

    if (fieldSchema.required && (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))) {
      errors.push(`"${type}" section: "${fieldName}" is required`);
      continue;
    }

    if (value === undefined || value === null) continue;

    if (fieldSchema.type === "array") {
      if (!Array.isArray(value)) {
        errors.push(`"${type}" section: "${fieldName}" must be an array`);
        continue;
      }
      // Validate array items if itemShape is defined
      if (fieldSchema.itemShape && value.length > 0) {
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (typeof item !== "object" || item === null) {
            errors.push(`"${type}" section: "${fieldName}[${i}]" must be an object`);
            continue;
          }
          for (const [itemField, itemFieldSchema] of Object.entries(fieldSchema.itemShape)) {
            const itemVal = (item as Record<string, unknown>)[itemField];
            if (itemFieldSchema.required && (itemVal === undefined || itemVal === null || itemVal === "")) {
              errors.push(`"${type}" section: "${fieldName}[${i}].${itemField}" is required`);
            }
          }
        }
      }
    } else if (fieldSchema.type === "number") {
      if (typeof value !== "number" || isNaN(value)) {
        errors.push(`"${type}" section: "${fieldName}" must be a number`);
      }
    } else if (fieldSchema.type === "string") {
      if (typeof value !== "string") {
        errors.push(`"${type}" section: "${fieldName}" must be a string`);
      }
    }
  }

  return errors;
}

export const get = async (_req: Request, res: Response): Promise<void> => {
  try {
    let page = await homePage.findOne();
    if (!page) {
      page = await homePage.create({ sections: [], version: 1 });
    }
    success(res, page, "Home page data loaded successfully");
  } catch (err) {
    fail(res, "Failed to load home page. Please try again.", 500);
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const sections = (req.body.sections ?? []) as Record<string, unknown>[];

    // Strip client-generated local IDs (_id: "local_xxx") so Mongoose doesn't
    // try to cast them to ObjectId. Existing sections with real MongoDB ObjectId
    // values (12/24 hex strings) are kept as-is.
    const cleanedSections = sections.map((s) => {
      const sec = { ...s } as Record<string, unknown>;
      if (typeof sec._id === "string" && (sec._id as string).startsWith("local_")) {
        delete sec._id;
      }
      return sec;
    });

    // Validate every section in the bulk update
    for (let i = 0; i < cleanedSections.length; i++) {
      const sec = cleanedSections[i] as { type?: string; config?: Record<string, unknown> };
      const validationErrors = validateSectionConfig(sec.type ?? "", sec.config);
      if (validationErrors.length > 0) {
        fail(res, `Section ${i + 1}: ${validationErrors.join(" ")}`, 400);
        return;
      }
    }

    const page = await homePage.findOneAndUpdate(
      {},
      { $set: { sections: cleanedSections }, $inc: { version: 1 } },
      { new: true, upsert: true },
    );
    cache.del(CACHE_KEY);
    const sectionCount = page?.sections?.length ?? 0;
    success(res, page, `Home page updated successfully with ${sectionCount} section${sectionCount !== 1 ? "s" : ""}`);
  } catch (err) {
    fail(res, "Failed to update home page. Please try again.", 500);
  }
};

export const addSection = async (req: Request, res: Response): Promise<void> => {
  try {
    const sectionType = req.body.type as string;
    const config = (req.body.config ?? {}) as Record<string, unknown>;

    const validationErrors = validateSectionConfig(sectionType, config);
    if (validationErrors.length > 0) {
      fail(res, validationErrors.join(" "), 400);
      return;
    }

    const section = {
      type: sectionType,
      config,
      order: (req.body.order ?? 0) as number,
      schemaVersion: 1,
    };

    const page = await homePage.findOneAndUpdate(
      {},
      { $push: { sections: section }, $inc: { version: 1 } },
      { new: true, upsert: true },
    );
    cache.del(CACHE_KEY);

    const added = page!.sections[page!.sections.length - 1];
    success(res, { section: added, page }, `"${sectionType}" section added successfully`);
  } catch (err) {
    fail(res, "Failed to add section. Please try again.", 500);
  }
};

export const updateSection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sectionId } = req.params;

    // If config is being updated, validate it against the (new or existing) type
    if (req.body.config !== undefined) {
      const sectionType = req.body.type as string | undefined;

      // If type is also changing, need to find the existing section to get current type
      let effectiveType = sectionType;
      if (!effectiveType) {
        const existingPage = await homePage.findOne(
          { "sections._id": sectionId },
          { "sections.$": 1 },
        ).lean();
        const existingSection = (existingPage?.sections ?? [])[0] as { type?: string } | undefined;
        effectiveType = existingSection?.type;
      }

      if (effectiveType) {
        const validationErrors = validateSectionConfig(effectiveType, req.body.config as Record<string, unknown>);
        if (validationErrors.length > 0) {
          fail(res, validationErrors.join(" "), 400);
          return;
        }
      }
    } else if (req.body.type !== undefined) {
      // Type is changing but config isn't — validate current config against new type
      const existingPage = await homePage.findOne(
        { "sections._id": sectionId },
        { "sections.$": 1 },
      ).lean();
      const existingSection = (existingPage?.sections ?? [])[0] as { config?: Record<string, unknown> } | undefined;
      if (existingSection?.config) {
        const validationErrors = validateSectionConfig(req.body.type as string, existingSection.config);
        if (validationErrors.length > 0) {
          fail(res, validationErrors.join(" "), 400);
          return;
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (req.body.type !== undefined) updateData["sections.$.type"] = req.body.type;
    if (req.body.config !== undefined) updateData["sections.$.config"] = req.body.config;
    if (req.body.order !== undefined) updateData["sections.$.order"] = req.body.order;

    const page = await homePage.findOneAndUpdate(
      { "sections._id": sectionId },
      { $set: updateData, $inc: { version: 1 } },
      { new: true },
    );
    if (!page) {
      fail(res, "Section not found. It may have been deleted.", 404);
      return;
    }
    cache.del(CACHE_KEY);
    success(res, page, "Section updated successfully");
  } catch (err) {
    fail(res, "Failed to update section. Please try again.", 500);
  }
};

export const removeSection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sectionId } = req.params;
    const page = await homePage.findOneAndUpdate(
      {},
      { $pull: { sections: { _id: sectionId } }, $inc: { version: 1 } },
      { new: true },
    );
    if (!page) {
      fail(res, "Home page not found", 404);
      return;
    }
    cache.del(CACHE_KEY);
    success(res, page, "Section removed successfully");
  } catch (err) {
    fail(res, "Failed to remove section. Please try again.", 500);
  }
};
