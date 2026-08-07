/**
 * Jewellery Walla — Production Data Migration Script
 * ==================================================
 *
 * Migrates CLONED jewellery-walla production data (from the old store) so it
 * matches the new branch's schemas. The old store used:
 *   • products.status = Boolean (true / false)
 *   • products.slug  — NOT unique
 *   • products.code  — NOT unique
 *   • no products.sku field
 *   • no products.weight field (now REQUIRED)
 *
 * The new branch uses:
 *   • products.status = string enum ["active" | "inactive" | "draft"]
 *   • unique indexes on slug, code (sparse), sku (sparse)
 *   • new optional fields: sku, giftImages, variants, type, tags, videoUrl,
 *     shortDescription, length, breadth, height (safe to leave missing)
 *   • new REQUIRED field: weight (backfilled, admin must verify)
 *   • products.images backfilled from products.image when empty
 *   • banners.status backfilled to true when missing (schema default)
 *   • products with empty colors/material/category/subCategory or price<=0
 *     are REPORTED for admin action (cannot be auto-fixed safely)
 *   • orders.shipping no longer has Shiprocket fields (cleaned up)
 *
 * SAFETY: runs in DRY-RUN mode by default and only prints what would change.
 * Pass `--fix` to actually apply changes. ALWAYS run against a CLONE first.
 *
 * Usage (from the repo root, after `pnpm install`):
 *   pnpm --filter api exec node scripts/migrate-prod.mjs                # dry run
 *   pnpm --filter api exec node scripts/migrate-prod.mjs --fix          # apply
 *   pnpm --filter api exec node scripts/migrate-prod.mjs --only-status  # only run the status migration
 *
 * The DB URL is read from `NEW_DB_URL` in api/.env, or passed as argv[2]:
 *   node scripts/migrate-prod.mjs mongodb://localhost:27017/jewellerywalla --fix
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const args = process.argv.slice(2);
const MONGO_URL = args.find((a) => /^mongodb(\+srv)?:\/\//.test(a)) ?? process.env.NEW_DB_URL;
const FIX = args.includes("--fix");
const ONLY_STATUS = args.includes("--only-status");

if (!MONGO_URL) {
  console.error("❌ No DB URL. Set NEW_DB_URL in api/.env or pass it as argv[2].");
  process.exit(1);
}

console.log(`\n${"═".repeat(64)}`);
console.log("  Jewellery Walla — Production Data Migration");
console.log(`  Mode: ${FIX ? "APPLY (--fix)" : "DRY-RUN (no changes written)"}`);
console.log(`  DB:   ${MONGO_URL.replace(/:[^:@/]+@/, ":***@")}`);
console.log(`${"═".repeat(64)}\n`);

// ─── Helpers ─────────────────────────────────────────────────────────────
function logChange(collection, field, detail) {
  console.log(`  [${collection}] ${field}: ${detail}`);
}

async function countBoolStatus(col) {
  return col.countDocuments({ status: { $type: "bool" } });
}

async function countStringStatus(col) {
  return col.countDocuments({ status: { $type: "string" } });
}

// Find duplicate values for a field (ignoring null/empty and soft-deleted docs
// unless `includeDeleted` is set — unique indexes apply to ALL docs though, so
// we default to checking everything and separately report deleted ones).
async function findDuplicates(col, field) {
  return col
    .aggregate([
      { $match: { [field]: { $type: "string", $ne: "" } } },
      { $group: { _id: `$${field}`, ids: { $push: "$_id" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
}

function cryptoRandomHex(len) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len);
}

// Prefer to keep a NON-deleted doc when de-duplicating — a live product should
// keep its URL/code; re-key the duplicates (which may be soft-deleted or older).
async function pickKeepId(col, ids) {
  const docs = await col
    .find({ _id: { $in: ids } })
    .select("deletedAt")
    .lean()
    .toArray();
  const live = docs.filter((d) => d.deletedAt == null);
  return String((live[0] ?? docs[0])?._id);
}

// ─── Step 1: products.status Boolean → enum string ───────────────────────
async function migrateProductStatus(db) {
  console.log("STEP 1: products.status Boolean → enum string");
  console.log("─".repeat(64));

  const col = db.collection("products");
  const boolCount = await countBoolStatus(col);
  const strCount = await countStringStatus(col);

  if (boolCount === 0) {
    console.log("  ✅ No boolean status values found. Nothing to do.");
  } else {
    console.log(`  ℹ️  Found ${boolCount} product(s) with boolean status.`);
    console.log(`  ℹ️  ${strCount} product(s) already use string status.`);

    if (FIX) {
      const res = await col.updateMany(
        { status: { $type: "bool" } },
        [
          {
            $set: {
              status: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$status", true] }, then: "active" },
                    { case: { $eq: ["$status", false] }, then: "inactive" },
                  ],
                  default: "inactive",
                },
              },
            },
          },
        ],
      );
      console.log(`  ✅ Updated ${res.modifiedCount} product(s) → "active"/"inactive".`);
    } else {
      console.log("  ⏭  Skipped (dry-run). Re-run with --fix to apply.");
    }
  }
  console.log();
}

// ─── Step 2: uniqueness checks (slug / code / sku) ───────────────────────
async function checkUniqueness(db) {
  console.log("STEP 2: Uniqueness checks on products (slug, code, sku)");
  console.log("─".repeat(64));

  const col = db.collection("products");
  let anyIssue = false;

  for (const field of ["slug", "code", "sku"]) {
    const dupes = await findDuplicates(col, field);
    if (dupes.length === 0) {
      console.log(`  ✅ ${field}: no duplicates.`);
      continue;
    }

    anyIssue = true;
    console.log(`  ⚠️  ${field}: ${dupes.length} duplicate value(s):`);
    for (const d of dupes.slice(0, 20)) {
      console.log(
        `      "${d._id}" → ${d.count} docs (ids: ${d.ids.map((i) => String(i)).join(", ")})`,
      );
    }
    if (dupes.length > 20) {
      console.log(`      … and ${dupes.length - 20} more.`);
    }

    if (FIX) {
      // Keep a non-deleted doc when possible, re-key the rest.
      let fixed = 0;
      for (const d of dupes) {
        const keepId = await pickKeepId(col, d.ids);
        const others = d.ids.filter((id) => String(id) !== keepId);
        for (const id of others) {
          let newValue;
          if (field === "slug") {
            // append a short unique suffix to keep URLs readable
            newValue = `${d._id}-${cryptoRandomHex(4)}`;
          } else {
            newValue = cryptoRandomHex(8);
          }
          await col.updateOne(
            { _id: id },
            { $set: { [field]: newValue } },
          );
          logChange("products", field, `${String(id)}: "${d._id}" → "${newValue}"`);
          fixed++;
        }
      }
      console.log(`  ✅ Re-keyed ${fixed} duplicate ${field} value(s).`);
    } else {
      console.log(`  ⏭  Skipped (dry-run). Re-run with --fix to re-key.`);
    }
  }

  // ── sku backfill (optional — new field) ──
  if (!ONLY_STATUS) {
    const missingSku = await col.countDocuments({
      $or: [{ sku: { $exists: false } }, { sku: null }, { sku: "" }],
    });
    if (missingSku > 0) {
      console.log(`  ℹ️  ${missingSku} product(s) have no SKU (new field — index is sparse, so this is fine).`);
      if (FIX) {
        const cursor = col.find({
          $or: [{ sku: { $exists: false } }, { sku: null }, { sku: "" }],
          deletedAt: null,
        });
        let added = 0;
        for await (const p of cursor) {
          const now = new Date();
          const yymmdd =
            String(now.getFullYear()).slice(2) +
            String(now.getMonth() + 1).padStart(2, "0") +
            String(now.getDate()).padStart(2, "0");
          const sku = `JWL-${yymmdd}-${cryptoRandomHex(8).toUpperCase()}`;
          await col.updateOne({ _id: p._id }, { $set: { sku } });
          added++;
        }
        console.log(`  ✅ Generated JWL- SKUs for ${added} product(s).`);
      } else {
        console.log("  ⏭  Skipped (dry-run). Re-run with --fix to generate SKUs.");
      }
    }
  }
  console.log();

  return anyIssue;
}

// ─── Step 3: backfill new REQUIRED product field — weight ────────────────
async function backfillProductWeight(db) {
  if (ONLY_STATUS) return;
  console.log("STEP 3: Backfill new REQUIRED product field — weight");
  console.log("─".repeat(64));

  const col = db.collection("products");
  const missing = await col.countDocuments({
    $or: [{ weight: { $exists: false } }, { weight: null }, { weight: "" }],
  });

  if (missing === 0) {
    console.log("  ✅ All products have a weight value.");
  } else {
    console.log(`  ⚠️  ${missing} product(s) have no "weight" (new REQUIRED field — validation will fail on next save).`);
    if (FIX) {
      // Default to "10" (grams, minimum plausible) so validation passes.
      // ⚠️ Admin MUST verify real weights before launch.
      const res = await col.updateMany(
        { $or: [{ weight: { $exists: false } }, { weight: null }, { weight: "" }] },
        { $set: { weight: "10" } },
      );
      console.log(`  ✅ Backfilled weight="10" (grams) for ${res.modifiedCount} product(s).`);
      console.log("  ⚠️  ADMIN ACTION: verify and update real weights in the admin panel.");
    } else {
      console.log("  ⏭  Skipped (dry-run). Re-run with --fix to backfill.");
    }
  }
  console.log();
}

// ─── Step 3b: backfill missing purity ──────────────────────────────────
async function backfillProductPurity(db) {
  if (ONLY_STATUS) return;
  console.log("STEP 3b: Backfill missing product purity");
  console.log("─".repeat(64));

  const col = db.collection("products");
  const missing = await col.countDocuments({
    $or: [{ purity: { $exists: false } }, { purity: null }, { purity: "" }],
  });

  if (missing === 0) {
    console.log("  ✅ All products have a purity value.");
  } else {
    console.log(`  ⚠️  ${missing} product(s) have no "purity" (REQUIRED field — validation will fail on next save).`);
    if (FIX) {
      const res = await col.updateMany(
        { $or: [{ purity: { $exists: false } }, { purity: null }, { purity: "" }] },
        { $set: { purity: "92.5%" } },
      );
      console.log(`  ✅ Backfilled purity="92.5%" for ${res.modifiedCount} product(s).`);
      console.log("  ⚠️  ADMIN ACTION: verify and update correct purity in the admin panel.");
    } else {
      console.log("  ⏭  Skipped (dry-run). Re-run with --fix to backfill.");
    }
  }
  console.log();
}

// ─── Step 3c: backfill empty products.images from products.image ──────────
async function backfillProductImages(db) {
  if (ONLY_STATUS) return;
  console.log("STEP 3c: Backfill empty product images from image");
  console.log("─".repeat(64));

  const col = db.collection("products");
  const empty = await col.countDocuments({
    $or: [{ images: { $exists: false } }, { images: [] }, { images: null }],
  });

  if (empty === 0) {
    console.log("  ✅ All products have a non-empty images array.");
  } else {
    const withImage = await col.countDocuments({
      $or: [{ images: { $exists: false } }, { images: [] }, { images: null }],
      image: { $exists: true, $ne: "", $ne: null },
    });
    console.log(`  ⚠️  ${empty} product(s) have an empty/missing "images" array.`);
    console.log(`      → ${withImage} of those have a primary "image" to copy.`);
    if (FIX) {
      const res = await col.updateMany(
        {
          $or: [{ images: { $exists: false } }, { images: [] }, { images: null }],
          image: { $exists: true, $ne: "", $ne: null },
        },
        [{ $set: { images: ["$image"] } }],
      );
      console.log(`  ✅ Backfilled images=[image] for ${res.modifiedCount} product(s).`);
      const stillEmpty = await col.countDocuments({
        $or: [{ images: { $exists: false } }, { images: [] }, { images: null }],
      });
      if (stillEmpty > 0) {
        console.log(`  ⚠️  ${stillEmpty} product(s) still have empty images (no primary image to copy) — admin action.`);
      }
    } else {
      console.log("  ⏭  Skipped (dry-run). Re-run with --fix to backfill.");
    }
  }
  console.log();
}

// ─── Step 4: clean Shiprocket fields from orders ─────────────────────────
async function cleanupOrderShiprocketFields(db) {
  if (ONLY_STATUS) return;
  console.log("STEP 4: Remove obsolete Shiprocket fields from orders");
  console.log("─".repeat(64));

  const col = db.collection("orders");
  const unsetFields = {
    "shipping.shiprocketOrderId": "",
    "shipping.shiprocketShipmentId": "",
    "shipping.rtoRequested": "",
    "shipping.rtoOrderId": "",
    "shipping.rtoStatus": "",
  };

  const hasAny = await col.countDocuments({
    $or: Object.keys(unsetFields).map((k) => ({ [k]: { $exists: true } })),
  });

  if (hasAny === 0) {
    console.log("  ✅ No orders carry obsolete Shiprocket fields.");
  } else {
    console.log(`  ⚠️  ${hasAny} order(s) still carry obsolete Shiprocket fields (shiprocketOrderId / shiprocketShipmentId / rto*).`);
    if (FIX) {
      const res = await col.updateMany({}, { $unset: unsetFields });
      console.log(`  ✅ Cleaned Shiprocket fields from ${res.modifiedCount} order(s).`);
    } else {
      console.log("  ⏭  Skipped (dry-run). Re-run with --fix to clean.");
    }
  }
  console.log();
}

// ─── Step 4b: backfill banners.status = true when missing ─────────────────
async function backfillBannerStatus(db) {
  if (ONLY_STATUS) return;
  console.log("STEP 4b: Backfill banners.status (schema default: true)");
  console.log("─".repeat(64));

  const col = db.collection("banners");
  const missing = await col.countDocuments({ status: { $exists: false } });

  if (missing === 0) {
    console.log("  ✅ All banners have a status.");
  } else {
    console.log(`  ⚠️  ${missing} banner(s) missing status field (schema default is true).`);
    if (FIX) {
      const res = await col.updateMany(
        { status: { $exists: false } },
        { $set: { status: true } },
      );
      console.log(`  ✅ Backfilled status=true for ${res.modifiedCount} banner(s).`);
    } else {
      console.log("  ⏭  Skipped (dry-run). Re-run with --fix to backfill.");
    }
  }
  console.log();
}

// ─── Step 5: ensure unique indexes exist ─────────────────────────────────
async function ensureIndexes(db) {
  console.log("STEP 5: Verify unique indexes (slug, code, sku)");
  console.log("─".repeat(64));
  const col = db.collection("products");

  // {field, opts} list in create order. Index name is auto-generated by
  // MongoDB, so `createIndex({slug:1},{unique:true})` → "slug_1". That name
  // clashes with an existing NON-unique auto-created "slug_1" (from the old
  // store) — MongoDB raises IndexKeySpecsConflict (code 86). We re-key an
  // explicitly named index instead so it can coexist with the old one, and
  // report the leftover non-unique index for manual drop.
  const targets = [
    { key: { slug: 1 }, opts: { unique: true }, label: "slug unique" },
    { key: { code: 1 }, opts: { unique: true, sparse: true }, label: "code unique (sparse)" },
    { key: { sku: 1 }, opts: { unique: true, sparse: true }, label: "sku unique (sparse)" },
  ];
  const idx = await col.indexes();
  let anyIssue = false;
  for (const t of targets) {
    const name = `${Object.keys(t.key)[0]}_1`;
    const existing = idx.find((i) => i.name === name);
    const matches = (i) =>
      i &&
      JSON.stringify(i.key) === JSON.stringify(t.key) &&
      (i.unique ?? false) === (t.opts.unique ?? false) &&
      (i.sparse ?? false) === (t.opts.sparse ?? false);
    if (matches(existing)) {
      console.log(`  ℹ️  ${t.label}: ✅`);
    } else if (existing) {
      anyIssue = true;
      console.log(`  ℹ️  ${t.label}: ❌ "${name}" exists but does NOT match (unique=${existing.unique ?? false}, sparse=${existing.sparse ?? false}).`);
      if (FIX) {
        // Old NON-unique index collides with the new UNIQUE index by name.
        // The new schema's unique constraint requires dropping the legacy one.
        // Safe to drop: STEP 2 verified no duplicate slug/code/sku values.
        await col.dropIndex(name);
        console.log(`      → dropped stale "${name}".`);
      } else {
        console.log("  ⏭  Skipped (dry-run). Re-run with --fix to drop & recreate.");
      }
    } else {
      anyIssue = true;
      console.log(`  ℹ️  ${t.label}: ❌ MISSING`);
    }
  }
  if (FIX) {
    for (const t of targets) {
      await col.createIndex(t.key, t.opts);
    }
    console.log("  ✅ Unique indexes created/confirmed.");
  } else if (anyIssue) {
    console.log("  ⏭  Skipped (dry-run). Re-run with --fix to create indexes.");
  }
  console.log();
}

// ─── Step 5b: ensure the weighted full-text search index ────────────────
async function ensureTextIndex(db) {
  if (ONLY_STATUS) return;
  console.log("STEP 5b: Verify weighted text-search index (product_text_search)");
  console.log("─".repeat(64));

  const col = db.collection("products");
  const idx = await col.indexes();
  const textIdx = idx.filter((i) => i.key && i.key._fts);

  const expectedWeights = {
    name: 10,
    tags: 5,
    shortDescription: 3,
    description: 1,
  };
  const normWeights = (w) =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(w ?? {}).sort(([a], [b]) => a.localeCompare(b)),
      ),
    );

  if (textIdx.length === 0) {
    console.log("  ⚠️  No text index found on products. Search endpoints require one.");
    if (FIX) {
      await col.createIndex(
        { name: "text", tags: "text", shortDescription: "text", description: "text" },
        { name: "product_text_search", weights: expectedWeights },
      );
      console.log("  ✅ Created product_text_search (name:10, tags:5, shortDescription:3, description:1).");
    } else {
      console.log("  ⏭  Skipped (dry-run). Re-run with --fix to create.");
    }
  } else {
    const current = textIdx[0];
    const ok =
      current.name === "product_text_search" &&
      normWeights(current.weights) === normWeights(expectedWeights);
    if (ok) {
      console.log("  ✅ product_text_search already present with the correct weights.");
    } else {
      console.log(`  ⚠️  Stale text index found: "${current.name}" (weights ${JSON.stringify(current.weights ?? {})}).`);
      console.log("      MongoDB allows only ONE text index per collection — the schema's");
      console.log("      weighted index was never created, so $text silently used the stale");
      console.log("      flat index (no tags/shortDescription, no relevance weighting).");
      if (FIX) {
        await col.dropIndex(current.name);
        await col.createIndex(
          { name: "text", tags: "text", shortDescription: "text", description: "text" },
          { name: "product_text_search", weights: expectedWeights },
        );
        console.log("  ✅ Dropped stale index and created product_text_search.");
      } else {
        console.log("  ⏭  Skipped (dry-run). Re-run with --fix to replace.");
      }
    }
  }
  console.log();
}

// ─── Step 5c: data-quality report (requires admin action) ────────────────
async function reportDataQuality(db) {
  if (ONLY_STATUS) return;
  console.log("STEP 5b: Data-quality report — items requiring admin action");
  console.log("─".repeat(64));

  const col = db.collection("products");

  const report = async (label, query, limit = 8) => {
    const liveQuery = { ...query, deletedAt: null };
    const count = await col.countDocuments(liveQuery);
    if (count === 0) {
      const deletedCount = await col.countDocuments(query);
      if (deletedCount === 0) {
        console.log(`  ✅ ${label}: 0`);
      } else {
        console.log(`  ✅ ${label}: 0 active (${deletedCount} soft-deleted only)`);
      }
      return;
    }
    console.log(`  ⚠️  ${label}: ${count} active product(s)`);
    const docs = await col
      .find(liveQuery)
      .project({ name: 1, status: 1 })
      .limit(limit)
      .toArray();
    for (const d of docs) {
      console.log(`      • "${d.name}" (status: ${d.status})`);
    }
    if (count > limit) console.log(`      … and ${count - limit} more`);
    const deletedCount = await col.countDocuments({ ...query, deletedAt: { $ne: null } });
    if (deletedCount > 0) console.log(`      (${deletedCount} soft-deleted product(s) with same issue — ignored)`);
  };

  await report("products with empty colors", {
    $or: [{ colors: { $exists: false } }, { colors: [] }, { colors: null }],
  });
  await report("products with empty material", {
    $or: [{ material: { $exists: false } }, { material: [] }, { material: null }],
  });
  await report("products with empty category", {
    $or: [{ category: { $exists: false } }, { category: [] }, { category: null }],
  });
  await report("products with empty subCategory", {
    $or: [{ subCategory: { $exists: false } }, { subCategory: [] }, { subCategory: null }],
  });
  await report("products with price <= 0", { price: { $lte: 0 } });

  // Malformed image URLs (e.g. "undefinedbanners/..." from a bad upload)
  const banners = db.collection("banners");
  const badBannerUrls = await banners
    .find({ image: /^undefined/ })
    .project({ image: 1, description: 1 })
    .limit(8)
    .toArray();
  if (badBannerUrls.length > 0) {
    console.log(`  ⚠️  banners with malformed image URL ("undefined..."): ${badBannerUrls.length}`);
    for (const b of badBannerUrls) {
      console.log(`      • "${b.description ?? ""}" → ${b.image}`);
    }
    console.log("      ℹ️  Re-upload these banner images in the admin panel.");
  } else {
    console.log("  ✅ banners with malformed image URLs: 0");
  }

  console.log(
    "\n  ℹ️  These cannot be safely auto-fixed (ObjectId references / business values).",
  );
  console.log(
    "      Fix them in the admin panel BEFORE launch — products without colors cannot be added to cart.",
  );
  console.log();
}

// ─── Step 6: sanity checks ───────────────────────────────────────────────
async function sanityCheck(db) {
  console.log("STEP 6: Sanity checks");
  console.log("─".repeat(64));

  const sizes = db.collection("sizes");
  const sizeCount = await sizes.countDocuments();
  const boolSize = await countBoolStatus(sizes);
  const strSize = await countStringStatus(sizes);
  console.log(`  ℹ️  sizes collection: ${sizeCount} document(s). (size model keeps Boolean status → no migration needed)`);
  if (sizeCount === 0) {
    console.log("  ℹ️  No sizes yet — admins create them in Admin → Sizes before linking to products.");
  } else {
    console.log(`      sizes.status — ${boolSize} boolean, ${strSize} string.`);
  }

  const products = db.collection("products");
  const noPurity = await products.countDocuments({
    $or: [{ purity: { $exists: false } }, { purity: null }, { purity: "" }],
  });
  console.log(`  ℹ️  products missing required "purity": ${noPurity}${noPurity ? " — ⚠️  will fail validation on next save. Admin must fill these." : " ✅"}`);

  // New optional product fields — informational only (safe to leave missing).
  for (const field of ["type", "tags", "videoUrl", "shortDescription", "giftImages", "variants", "length", "breadth", "height"]) {
    const missing = await products.countDocuments({ [field]: { $exists: false } });
    if (missing > 0) {
      console.log(`  ℹ️  products missing optional "${field}": ${missing} (safe — field is optional).`);
    }
  }

  // Orders sanity
  const orders = db.collection("orders");
  const totalOrders = await orders.countDocuments();
  console.log(`  ℹ️  orders total: ${totalOrders}.`);
  console.log();
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  await migrateProductStatus(db);
  await checkUniqueness(db);
  await backfillProductWeight(db);
  await backfillProductPurity(db);
  await backfillProductImages(db);
  await cleanupOrderShiprocketFields(db);
  await backfillBannerStatus(db);
  await ensureIndexes(db);
  await ensureTextIndex(db);
  await reportDataQuality(db);
  await sanityCheck(db);

  console.log(`${"═".repeat(64)}`);
  console.log(FIX ? "  ✅ Migration complete (--fix applied)." : "  ✅ Dry-run complete. No changes written.");
  console.log("  ⚠️  Double-check results against a test clone before running --fix on production.");
  console.log(`${"═".repeat(64)}\n`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\n❌ Migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
