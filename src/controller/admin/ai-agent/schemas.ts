import { z } from "zod";

// ── Common color name → hex lookup ────────────────────────────────
export const COLOR_NAME_HEX: Record<string, string> = {
  red: "#FF0000", "dark red": "#8B0000", "light red": "#FF7F7F", crimson: "#DC143C",
  blue: "#0000FF", "dark blue": "#00008B", "light blue": "#ADD8E6", "sky blue": "#87CEEB", navy: "#000080", "royal blue": "#4169E1", "baby blue": "#89CFF0",
  green: "#008000", "dark green": "#006400", "light green": "#90EE90", lime: "#00FF00", olive: "#808000", emerald: "#50C878", "forest green": "#228B22",
  yellow: "#FFFF00", "light yellow": "#FFFFE0", gold: "#FFD700", amber: "#FFBF00",
  orange: "#FFA500", "dark orange": "#FF8C00", "light orange": "#FFD580", coral: "#FF7F50",
  purple: "#800080", "dark purple": "#4B0082", "light purple": "#CBC3E3", lavender: "#E6E6FA", violet: "#8F00FF", magenta: "#FF00FF",
  pink: "#FFC0CB", "hot pink": "#FF69B4", "light pink": "#FFB6C1", rose: "#FF007F",
  brown: "#A52A2A", "light brown": "#D2B48C", tan: "#D2B48C", chocolate: "#7B3F00",
  black: "#000000", white: "#FFFFFF", gray: "#808080", grey: "#808080", "light gray": "#D3D3D3", "dark gray": "#A9A9A9", silver: "#C0C0C0",
  teal: "#008080", cyan: "#00FFFF", aqua: "#00FFFF", turquoise: "#40E0D0", indigo: "#4B0082",
  maroon: "#800000", beige: "#F5F5DC", mint: "#98FF98", peach: "#FFDAB9", salmon: "#FA8072",
  khaki: "#F0E68C", plum: "#DDA0DD", orchid: "#DA70D6", ivory: "#FFFFF0",
  "bright red": "#FF1A1A", "electric blue": "#0066FF", "neon green": "#39FF14",
};

// ── Helper: convert color name to hex ─────────────────────────────
export function colorNameToHex(name: string): string {
  const clean = name.toLowerCase().trim();
  if (COLOR_NAME_HEX[clean]) return COLOR_NAME_HEX[clean];
  if (/^#?[0-9A-Fa-f]{3,8}$/.test(clean)) {
    return clean.startsWith("#") ? clean : `#${clean}`;
  }
  const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, "0");
  return `#${hex}`;
}

// ── Schema definitions for tool arguments ─────────────────────────
export const faqSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  order: z.number().int().min(0).max(1000).optional().default(0),
  status: z.boolean().optional().default(false),
});

export const materialSchema = z.object({
  name: z.string().min(1, "Name is required"),
  order: z.number().int().min(0).max(1000).optional().default(0),
  status: z.boolean().optional().default(false),
});

export const colorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().regex(/^[a-zA-Z0-9# ]+$/, "Code must match /^[a-zA-Z0-9# ]+$/").optional(),
  order: z.number().int().min(0).max(1000).optional().default(0),
  status: z.boolean().optional().default(false),
});

export const productDraftSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(1, "Description is required"),
  price: z.number().positive("Price must be greater than 0"),
  discount_price: z.number().positive("Discount price must be greater than 0").optional(),
  stock: z.number().int().min(0, "Stock cannot be negative").optional().default(0),
  category: z.array(z.string().min(1)).min(1, "At least one category is required"),
  subCategory: z.array(z.string().min(1)).optional().default([]),
  subSubCategory: z.array(z.string().min(1)).optional().default([]),
  colors: z.array(z.string().min(1)).min(1, "At least one color is required"),
  material: z.array(z.string().min(1)).optional().default([]),
  weight: z.string().min(1, "Weight is required").optional(),
  estimated_delivery_time: z.string().min(1).optional(),
  code: z.string().optional(),
  type: z.string().optional(),
  sku: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  shortDescription: z.string().optional(),
  minimumAge: z.number().int().positive().optional(),
  maximumAge: z.number().int().positive().optional(),
  idealAge: z.number().int().positive().optional(),
  isFeatured: z.boolean().optional().default(false),
  isNewArrival: z.boolean().optional().default(false),
  isBestSeller: z.boolean().optional().default(false),
  isOnSale: z.boolean().optional().default(false),
  isGift: z.boolean().optional().default(false),
  isPersonalized: z.boolean().optional().default(false),
});

export const searchProductSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  limit: z.number().int().positive().optional().default(10),
});

export const searchFaqSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  limit: z.number().int().positive().optional().default(10),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  order: z.number().int().min(0).max(1000).optional().default(0),
  status: z.boolean().optional().default(false),
});

export const createSubCategorySchema = z.object({
  name: z.string().min(1, "Sub-category name is required"),
  category: z.array(z.string().min(1)).min(1, "At least one category ID is required"),
  description: z.string().optional(),
  order: z.number().int().min(0).max(1000).optional().default(0),
  status: z.boolean().optional().default(false),
});

export const createSubSubCategorySchema = z.object({
  name: z.string().min(1, "Sub-sub-category name is required"),
  subCategory: z.array(z.string().min(1)).min(1, "At least one sub-category ID is required"),
  description: z.string().optional(),
  order: z.number().int().min(0).max(1000).optional().default(0),
  status: z.boolean().optional().default(false),
});

export const updateProductSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  status: z.enum(["active", "inactive", "draft"]).optional(),
  price: z.number().positive().optional(),
  discount_price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  isFeatured: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isOnSale: z.boolean().optional(),
  isGift: z.boolean().optional(),
  isPersonalized: z.boolean().optional(),
});

export const createBannerSchema = z.object({
  description: z.string().min(1, "Description is required"),
  order: z.number().int().min(0).max(1000).optional().default(0),
  status: z.boolean().optional().default(false),
});

export const createTestimonialSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  address: z.string().min(1, "Address is required"),
  image: z.string().optional(),
  status: z.boolean().optional().default(false),
});

export const createWhyChooseUsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  image: z.string().optional(),
  status: z.boolean().optional().default(false),
});

export const searchWhyChooseUsSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  limit: z.number().int().positive().optional().default(10),
});

export const createCouponSchema = z.object({
  name: z.string().min(1, "Coupon name is required"),
  code: z.string().min(1, "Coupon code is required"),
  discountPercentage: z.number().min(0, "Discount must be >= 0").max(100, "Discount must be <= 100"),
  minAmount: z.number().min(0, "Min amount must be >= 0"),
  maxAmount: z.number().min(0, "Max amount must be >= 0"),
  description: z.string().optional().default(""),
  expiryDate: z.string().optional(),
  status: z.boolean().optional().default(false),
  type: z.enum(["public", "private"]).optional().default("public"),
});

export const lookupQuerySchema = z.object({
  query: z.string().optional().default(""),
});

export const fetchUrlSchema = z.object({
  url: z.string().url("A valid URL is required").min(1),
  maxChars: z.number().int().positive().optional().default(5000),
});

export const searchWebSchema = z.object({
  query: z.string().min(1, "Search query is required"),
});
