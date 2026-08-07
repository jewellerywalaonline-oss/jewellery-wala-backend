/**
 * @openapi
 * tags:
 *   - name: Products
 *     description: Product listing, search, and filtering
 *
 * /api/website/product/details/{slug}:
 *   get:
 *     tags: [Products]
 *     summary: Get product by slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data: { $ref: '#/components/schemas/Product' }
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/product/get-by-category/{categorySlug}/{subCategorySlug}/{subSubCategorySlug}:
 *   post:
 *     tags: [Products]
 *     summary: Get products by category hierarchy
 *     parameters:
 *       - in: path
 *         name: categorySlug
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: subCategorySlug
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: subSubCategorySlug
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Products fetched with pagination
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/product/get-by-filter:
 *   get:
 *     tags: [Products]
 *     summary: Filter products by various criteria
 *     parameters:
 *       - in: query
 *         name: categorySlug
 *         schema: { type: string }
 *       - in: query
 *         name: subCategorySlug
 *         schema: { type: string }
 *       - in: query
 *         name: subSubCategorySlug
 *         schema: { type: string }
 *       - in: query
 *         name: colorIds
 *         schema: { type: string }
 *         description: Comma-separated color IDs
 *       - in: query
 *         name: materialIds
 *         schema: { type: string }
 *         description: Comma-separated material IDs
 *       - in: query
 *         name: priceFrom
 *         schema: { type: number }
 *       - in: query
 *         name: priceTo
 *         schema: { type: number }
 *       - in: query
 *         name: searchQuery
 *         schema: { type: string }
 *       - in: query
 *         name: isNewArrival
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: isBestSeller
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: isFeatured
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: isOnSale
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Filtered products with pagination
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/product/get-by-search:
 *   get:
 *     tags: [Products]
 *     summary: Search products by text
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Search results
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/product/get-related-products:
 *   get:
 *     tags: [Products]
 *     summary: Get related products
 *     parameters:
 *       - in: query
 *         name: subCategoryIds
 *         schema: { type: string }
 *         description: Comma-separated sub-category IDs
 *       - in: query
 *         name: subSubCategoryIds
 *         schema: { type: string }
 *         description: Comma-separated sub-sub-category IDs
 *     responses:
 *       200:
 *         description: Related products
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/product/tab-products:
 *   get:
 *     tags: [Products]
 *     summary: Get tab products (gold, silver, gift)
 *     responses:
 *       200:
 *         description: Tab products grouped by material
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/product/new-arrivals:
 *   get:
 *     tags: [Products]
 *     summary: Get new arrival products
 *     responses:
 *       200:
 *         description: New arrivals
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/product/trending-products:
 *   get:
 *     tags: [Products]
 *     summary: Get trending/upsell products
 *     responses:
 *       200:
 *         description: Trending products
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/product/best-sellers:
 *   get:
 *     tags: [Products]
 *     summary: Get best selling products
 *     responses:
 *       200:
 *         description: Best sellers
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/product/featured-for-footer:
 *   get:
 *     tags: [Products]
 *     summary: Get featured products for footer display
 *     responses:
 *       200:
 *         description: Featured products
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/product/all:
 *   get:
 *     tags: [Products]
 *     summary: Get all active products (for sitemap)
 *     responses:
 *       200:
 *         description: All products
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import {
  getOne,
  getByCategory,
  getProductByFilter,
  getBySearch,
  getAll,
  relatedProducts,
  tabProducts,
  newArrivals,
  trendingProducts,
  bestSellers,
  featuredForFooter,
  getByIds,
} from "../../controller/web/product.controller.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";
import rateLimit from "../../middleware/rateLimit.js";

const router = Router();

// Category routes
router.get("/details/:slug", rateLimit.publicProducts, getOne);
router.post(
  "/get-by-category/:categorySlug/:subCategorySlug/:subSubCategorySlug",
  rateLimit.publicProducts,
  uploadNone,
  getByCategory,
);
router.get("/get-by-filter", rateLimit.publicProducts, getProductByFilter);
router.get("/get-by-search", rateLimit.publicProducts, getBySearch);
router.get("/get-related-products", rateLimit.publicProducts, relatedProducts);
// tab products
router.get("/tab-products", rateLimit.publicProducts, tabProducts);
router.get("/new-arrivals", rateLimit.publicProducts, newArrivals);
router.get("/trending-products", rateLimit.publicProducts, trendingProducts);
router.get("/best-sellers", rateLimit.publicProducts, bestSellers);
router.get("/featured-for-footer", rateLimit.publicProducts, featuredForFooter);

// sitemap products
router.get("/all", rateLimit.publicProducts, getAll);

// batch fetch by IDs (POST to allow body)
router.post("/batch", rateLimit.publicProducts, uploadNone, getByIds);

export default router;
