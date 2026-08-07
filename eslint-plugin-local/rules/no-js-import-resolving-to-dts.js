"use strict";

/**
 * @fileoverview
 * ESLint rule: no-js-import-resolving-to-dts
 *
 * Detects import statements with a `.js` extension where the resolved file
 * on disk is ONLY a `.d.ts` declaration file (no corresponding `.ts` or `.js`
 * file exists). This pattern compiles for type-checking but fails at runtime
 * with ERR_MODULE_NOT_FOUND because `.d.ts` files have no runtime output.
 *
 * Correct approach: use `/// <reference path="..." />` instead.
 */

const path = require("node:path");
const fs = require("node:fs");

/**
 * Given a directory and an import path (e.g. `../../types/express`),
 * returns the .d.ts path if ONLY a .d.ts file exists (no companion .ts/.js),
 * or null if the import resolves to a valid runtime module or nothing.
 */
function findOnlyDtsFile(dir, importPathWithoutExt) {
  const base = path.resolve(dir, importPathWithoutExt);

  // If there's a .ts or .js source, the import is valid at runtime
  if (fs.existsSync(base + ".ts") || fs.existsSync(base + ".js")) return null;

  // If only a .d.ts exists, that's the problematic pattern
  const dtsPath = base + ".d.ts";
  if (fs.existsSync(dtsPath)) return dtsPath;

  // No files at all — let other rules handle it (likely a different error)
  return null;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow .js imports that resolve only to .d.ts declaration files with no runtime module",
      recommended: true,
    },
    schema: [],
    messages: {
      resolvesToDts:
        "Import '{{source}}' resolves only to '{{resolved}}' which has no runtime output. " +
        "Use `/// <reference path=\"{{resolved}}\" />` instead of a module import for .d.ts type augmentations.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const dir = path.dirname(filename);

    return {
      ImportDeclaration(node) {
        const source = node.source?.value;
        if (!source || typeof source !== "string") return;

        // Only check relative imports with .js extension
        if (!source.startsWith(".") || !source.endsWith(".js")) return;

        // Strip the .js extension to check for companion files
        const withoutExt = source.slice(0, -3);

        const dtsPath = findOnlyDtsFile(dir, withoutExt);
        if (dtsPath) {
          // Use the import path with .d.ts extension — this is the correct
          // relative path for the triple-slash reference suggestion
          const relativeRefPath = source.slice(0, -3) + ".d.ts";
          context.report({
            node,
            messageId: "resolvesToDts",
            data: {
              source,
              resolved: relativeRefPath,
            },
          });
        }
      },
    };
  },
};
