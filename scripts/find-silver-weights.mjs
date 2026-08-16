/**
 * Jewellery Walla — Silver Products Weight Finder
 * ===============================================
 *
 * Finds all products whose material is silver (name matches /silver/i, e.g.
 * "Silver", "Rough Silver", "Pure Silver"), scans each product's description
 * for a "weight = X.XXX" section (weight can be any number), and writes a
 * Markdown report with:
 *   • product id
 *   • product name
 *   • weight found in description
 *   • product image (embedded in the markdown)
 *
 * Usage (from the repo root, after `pnpm install`):
 *   pnpm --filter api exec node scripts/find-silver-weights.mjs
 *   pnpm --filter api exec node scripts/find-silver-weights.mjs path/to/report.md
 *
 * The DB URL is read from `NEW_DB_URL` in api/.env, or passed as argv[2]:
 *   node scripts/find-silver-weights.mjs mongodb://localhost:27017/jewelley_walla
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const args = process.argv.slice(2);
const MONGO_URL = args.find((a) => /^mongodb(\+srv)?:\/\//.test(a)) ?? process.env.NEW_DB_URL;
const OUTPUT_FILE = path.resolve(args.find((a) => a.endsWith(".md")) ?? "silver-product-weights.md");

if (!MONGO_URL) {
  console.error("No DB URL. Set NEW_DB_URL in api/.env or pass it as argv[2].");
  process.exit(1);
}

const WEIGHT_RE = /weight\s*[=:]\s*([\d.,]+)/gi;

function extractWeight(description) {
  if (typeof description !== "string" || !description) return null;
  const matches = [...description.matchAll(WEIGHT_RE)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1];
}

async function main() {
  console.log(`Connecting to ${MONGO_URL.replace(/:[^:@/]+@/, ":***@")} ...`);
  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const products = db.collection("products");
  const materials = db.collection("materials");

  const silverMats = await materials
    .find({ name: /silver/i })
    .project({ name: 1 })
    .toArray();
  const silverIds = silverMats.map((m) => m._id);
  console.log(
    `Silver materials found: ${silverMats.map((m) => m.name).join(", ") || "(none)"}`,
  );

  if (silverIds.length === 0) {
    console.log("No silver materials found — nothing to scan. Exiting.");
    await mongoose.disconnect();
    return;
  }

  const cursor = products
    .find({ material: { $in: silverIds }, deletedAt: null })
    .project({ name: 1, image: 1, description: 1 })
    .sort({ createdAt: 1 });

  const rows = [];
  let total = 0;
  let withWeight = 0;

  for await (const p of cursor) {
    total++;
    const weight = extractWeight(p.description);
    if (weight == null) continue;
    withWeight++;
    rows.push({ id: String(p._id), name: p.name, image: p.image, weight });
  }

  const imageFor = (url) =>
    url && typeof url === "string" && url.trim()
      ? `![image](${url.trim()})`
      : "-";

  const lines = [];
  lines.push("# Silver Products — Description Weight Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`- Total silver products scanned: **${total}**`);
  lines.push(`- Products with a description weight found: **${withWeight}**`);
  lines.push("");
  lines.push("| # | Product ID | Name | Weight Found | Image |");
  lines.push("|---|------------|------|--------------|-------|");
  rows.forEach((r, i) => {
    const name = r.name.replace(/\|/g, "\\|");
    lines.push(
      `| ${i + 1} | \`${r.id}\` | ${name} | ${r.weight} | ${imageFor(r.image)} |`,
    );
  });
  lines.push("");

  fs.writeFileSync(OUTPUT_FILE, lines.join("\n"), "utf8");
  console.log(
    `\nScanned ${total} silver product(s), ${withWeight} had a description weight.`,
  );
  console.log(`Report written to: ${OUTPUT_FILE}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\nFailed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});