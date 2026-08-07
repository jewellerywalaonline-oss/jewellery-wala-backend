import Product from "../models/product.js";

export interface CartItemInput {
  productId: string;
  colorId: string;
  quantity: number;
  /** Optional Buy Now variant (quantity tier / option add-on). When set,
   *  the server derives price + quantity from the stored variant — the
   *  client-supplied quantity/price are ignored (tamper-proof). */
  variantId?: string;
  /** Optional jewellery size (ring size, bangle size, etc.). */
  sizeId?: string;
}

export interface ValidatedItem {
  productId: string;
  colorId: string;
  name: string;
  description: string;
  image: string;
  images: string[];
  sku: string;
  quantity: number;
  isPersonalized: boolean;
  priceAtPurchase: number;
  subtotal: number;
  variantName?: string;
  /** Jewellery size selected at purchase time (null when not applicable). */
  sizeId?: string | null;
}

export interface ItemError {
  productId: string;
  type: "deleted" | "inactive" | "invalid_color" | "insufficient_stock" | "invalid_variant";
  message: string;
  quantity: number;
  availableStock?: number;
}

export class CartValidationError extends Error {
  public readonly items: ItemError[];
  public readonly validItems: ValidatedItem[];
  public readonly recoverable: boolean;

  constructor(items: ItemError[], validItems: ValidatedItem[]) {
    const isRecoverable = items.every((i) => i.type === "insufficient_stock");
    super(
      isRecoverable
        ? "Some items have limited stock"
        : "Some items in your cart are no longer available",
    );
    this.name = "CartValidationError";
    this.items = items;
    this.validItems = validItems;
    this.recoverable = isRecoverable;
  }
}

export async function validateAndPriceCart(
  items: CartItemInput[],
): Promise<ValidatedItem[]> {
  if (items.length === 0) {
    throw new CartValidationError(
      [{ productId: "", type: "deleted" as const, message: "Cart is empty", quantity: 0 }],
      [],
    );
  }

  const productIds = items.map((i) => i.productId);

  const products = await Product.find({
    _id: { $in: productIds },
  })
    .select(
      "name description image images code stock status isPersonalized price discount_price colors deletedAt variants",
    )
    .lean();

  const productMap = new Map(
    products.map((p) => [String(p._id), p]),
  );

  const errors: ItemError[] = [];
  const validItems: ValidatedItem[] = [];

  for (const item of items) {
    const product = productMap.get(item.productId);

    if (!product) {
      errors.push({
        productId: item.productId,
        type: "deleted",
        message: "Product not found or has been removed",
        quantity: item.quantity,
      });
      continue;
    }

    if (product.deletedAt) {
      errors.push({
        productId: item.productId,
        type: "deleted",
        message: `"${product.name}" is no longer available`,
        quantity: item.quantity,
      });
      continue;
    }

    if (product.status !== "active") {
      errors.push({
        productId: item.productId,
        type: "inactive",
        message: `"${product.name}" is currently unavailable`,
        quantity: item.quantity,
      });
      continue;
    }

    const colorIdStr = item.colorId;

    // Edge case: if colorId is null/undefined/"null" string, treat as invalid
    if (!colorIdStr || colorIdStr === "null" || colorIdStr === "undefined") {
      errors.push({
        productId: item.productId,
        type: "invalid_color",
        message: `A valid color selection is required for "${product.name}"`,
        quantity: item.quantity,
      });
      continue;
    }

    // Safely check colors array — it could be empty or undefined with .lean()
    const productColors = product.colors ?? [];
    if (productColors.length === 0) {
      errors.push({
        productId: item.productId,
        type: "invalid_color",
        message: `"${product.name}" has no colors configured. Please contact support.`,
        quantity: item.quantity,
      });
      continue;
    }

    const isValidColor = productColors.some(
      (c) => String(c).trim() === colorIdStr.trim(),
    );
    if (!isValidColor) {
      errors.push({
        productId: item.productId,
        type: "invalid_color",
        message: `Selected color is not available for "${product.name}". Please remove it from your cart and select a different color.`,
        quantity: item.quantity,
      });
      continue;
    }

    // ── Buy Now variant resolution (pack price, tamper-proof) ──
    // When a variantId is present, the server derives quantity + price from
    // the stored variant. The client-supplied quantity is overridden so a
    // buyer can never manipulate pricing.
    let resolvedQuantity = item.quantity;
    let variantName: string | undefined;
    let unitPrice = product.discount_price || product.price;
    let packTotal: number | undefined;

    if (item.variantId) {
      const variants = (product.variants ?? []) as Array<{
        _id: unknown;
        name: string;
        quantity: number;
        price: number;
      }>;
      const variant = variants.find(
        (v) => String(v._id) === String(item.variantId),
      );

      if (!variant) {
        errors.push({
          productId: item.productId,
          type: "invalid_variant",
          message: `The selected offer for "${product.name}" is no longer available. Please refresh and try again.`,
          quantity: item.quantity,
        });
        continue;
      }

      resolvedQuantity = Math.max(1, Math.floor(Number(variant.quantity) || 1));
      variantName = variant.name;
      // Pack total price → per-unit price, float-safe (2 decimals).
      unitPrice = Math.round((variant.price / resolvedQuantity) * 100) / 100;
      // The pack price is the admin's authoritative number — subtotal must
      // equal it exactly, even when per-unit rounding would drift (e.g. 3 @ ₹100).
      packTotal = Math.round(Number(variant.price) * 100) / 100;
    }

    if (product.stock < resolvedQuantity) {
      errors.push({
        productId: item.productId,
        type: "insufficient_stock",
        message: `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${resolvedQuantity}`,
        quantity: resolvedQuantity,
        availableStock: product.stock,
      });
      continue;
    }

    const priceAtPurchase = unitPrice;
    const subtotal =
      packTotal != null ? packTotal : Math.round(priceAtPurchase * resolvedQuantity * 100) / 100;

    validItems.push({
      productId: String(product._id),
      colorId: item.colorId,
      sizeId: item.sizeId ?? null,
      name: product.name,
      description: product.description ?? "",
      image: product.image,
      images: product.images ?? [],
      sku: product.code,
      quantity: resolvedQuantity,
      isPersonalized: product.isPersonalized ?? false,
      priceAtPurchase,
      subtotal,
      variantName,
    });
  }

  if (errors.length > 0) {
    throw new CartValidationError(errors, validItems);
  }

  return validItems;
}
