import ProductModel from "../../../models/product.js";
import slugifyLib from "slugify";

export function isDuplicateError(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function slugify(text: string): string {
  return slugifyLib(text, { lower: true, strict: true }).slice(0, 80);
}

export async function generateSlug(text: string): Promise<string> {
  const base = slugify(text);
  const count = await ProductModel.countDocuments({
    slug: new RegExp(`^${escapeRegex(base)}`),
  });
  return count === 0 ? base : `${base}-${count}`;
}
