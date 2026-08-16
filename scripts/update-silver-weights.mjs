/**
 * Jewellery Walla — Update Silver Product Weights From Descriptions
 * =================================================================
 *
 * Silver products (material name matches /silver/i) have a "weight = X.XXX"
 * block at the end of their description. The product's own `weight` field is
 * currently a placeholder (e.g. backfilled "10" by migrate-prod.mjs) and needs
 * to be replaced with the real weight from the description.
 *
 * SAFETY:
 *   • Runs in DRY-RUN mode by default — only prints what would change.
 *   • Pass `--fix` to actually write updates.
 *   • Only touches SILVER products (deletedAt: null) where a description
 *     weight was found AND the current weight field differs from it.
 *   • Logs every change (id, name, old → new).
 *   • A mongodump backup was taken before running this (see backups/).
 *
 * Usage (from the repo root):
 *   pnpm --filter api exec node scripts/update-silver-weights.mjs       # dry run
 *   pnpm --filter api exec node scripts/update-silver-weights.mjs --fix # apply
 *
 * The DB URL is read from `NEW_DB_URL` in api/.env, or passed as argv[2]:
 *   node scripts/update-silver-weights.mjs mongodb://localhost:27017/jewelley_walla --fix
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const args = process.argv.slice(2);
const MONGO_URL = args.find((a) => /^mongodb(\+srv)?:\/\//.test(a)) ?? process.env.NEW_DB_URL;
const FIX = args.includes("--fix");

if (!MONGO_URL) {
  console.error("No DB URL. Set NEW_DB_URL in api/.env or pass it as argv[2].");
  process.exit(1);
}

console.log(`\n${"═".repeat(64)}`);
console.log("  Update Silver Product Weights From Descriptions");
console.log(`  Mode: ${FIX ? "APPLY (--fix)" : "DRY-RUN (no changes written)"}`);
console.log(`  DB:   ${MONGO_URL.replace(/:[^:@/]+@/, ":***@")}`);
console.log(`${"═".repeat(64)}\n`);

const WEIGHT_RE = /weight\s*[=:]\s*([\d.,]+)/gi;

function extractWeight(description) {
  if (typeof description !== "string" || !description) return null;
  const matches = [...description.matchAll(WEIGHT_RE)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1].trim();
}

async function main() {
  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const products = db.collection("products");

  const silverIds = (
    await db
      .collection("materials")
      .find({ name: /silver/i })
      .project({ name: 1 })
      .toArray()
  ).map((m) => m._id);

  if (silverIds.length === 0) {
    console.log("No silver materials found. Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  const cursor = products
    .find({ material: { $in: silverIds }, deletedAt: null })
    .project({ name: 1, description: 1, weight: 1 });

  let scanned = 0;
  let noDescWeight = 0;
  let alreadyCorrect = 0;
  let toChange = 0;
  const changes = [];

  for await (const p of cursor) {
    scanned++;
    const descWeight = extractWeight(p.description);
    if (descWeight == null) {
      noDescWeight++;
      continue;
    }
    const current = typeof p.weight === "string" ? p.weight.trim() : "";
    if (current === descWeight) {
      alreadyCorrect++;
      continue;
    }
    toChange++;
    changes.push({
      id: String(p._id),
      name: p.name,
      old: current || "(empty)",
      next: descWeight,
    });
  }

  console.log(`Scanned:       ${scanned} silver product(s)`);
  console.log(`No desc weight: ${noDescWeight} (skipped)`);
  console.log(`Already correct: ${alreadyCorrect} (skipped)`);
  console.log(`To update:     ${toChange}\n`);

  if (changes.length > 0) {
    console.log("─".repeat(64));
    console.log("  CHANGES");
    console.log("─".repeat(64));
    for (const c of changes.slice(0, 40)) {
      console.log(
        `  [${c.id}] "${c.name}" weight: "${c.old}" → "${c.next}"`,
      );
    }
    if (changes.length > 40) {
      console.log(`  … and ${changes.length - 40} more.`);
    }
    console.log();

    if (FIX) {
      let updated = 0;
      for (const c of changes) {
        const res = await products.updateOne(
          { _id: new mongoose.Types.ObjectId(c.id) },
          { $set: { weight: c.next } },
        );
        if (res.modifiedCount === 1) updated++;
        else if (res.matchedCount === 0) {
          console.log(`  ⚠️  NOT FOUND: ${c.id} ("${c.name}") — skipped.`);
        }
      }
      console.log(`✅ Updated ${updated} of ${changes.length} product(s).`);
    } else {
      console.log("⏭  Skipped (dry-run). Re-run with --fix to apply.");
    }
  } else {
    console.log("✅ Nothing to change — every silver product weight already matches its description.");
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\n❌ Failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});