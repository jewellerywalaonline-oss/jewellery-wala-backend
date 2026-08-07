/**
 * Copies the EJS email templates from src/views into dist/views.
 *
 * `tsc -p tsconfig.build.json` only emits compiled TypeScript — it does NOT
 * copy the .ejs view files. In production the API runs from dist/, so
 * nodemailer's `renderTemplate` looks in dist/views/emails/ and fails with
 * ENOENT unless we copy the templates over after the build.
 *
 * Usage: `node scripts/copy-views.mjs` (run after `tsc` in the build step)
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const srcViews = join(projectRoot, "src", "views");
const distViews = join(projectRoot, "dist", "views");

if (!existsSync(srcViews)) {
  console.error(`[copy-views] Source views dir not found: ${srcViews}`);
  process.exit(1);
}

mkdirSync(distViews, { recursive: true });
cpSync(srcViews, distViews, { recursive: true });
console.log(`[copy-views] Copied ${srcViews} → ${distViews}`);
