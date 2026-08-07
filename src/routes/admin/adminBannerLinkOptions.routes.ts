/**
 * @openapi
 * tags:
 *   - name: Admin - Banner Link Options
 *     description: Options for banner link dropdowns
 *
 * /api/admin/banner-link-options/products:
 *   get:
 *     tags: [Admin - Banner Link Options]
 *     summary: Get products for banner link dropdown
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Product options
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/admin/banner-link-options/categories:
 *   get:
 *     tags: [Admin - Banner Link Options]
 *     summary: Get categories for banner link dropdown
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Category options
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/admin/banner-link-options/subcategories:
 *   get:
 *     tags: [Admin - Banner Link Options]
 *     summary: Get sub-categories for banner link dropdown
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Sub-category options
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/admin/banner-link-options/subsubcategories:
 *   get:
 *     tags: [Admin - Banner Link Options]
 *     summary: Get sub-sub-categories for banner link dropdown
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Sub-sub-category options
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import {
  getProducts,
  getCategories,
  getSubCategories,
  getSubSubCategories,
} from "../../controller/admin/adminBannerLinkOptions.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";

const router = Router();

router.get("/products", protect, adminOnly, getProducts);
router.get("/categories", protect, adminOnly, getCategories);
router.get("/subcategories", protect, adminOnly, getSubCategories);
router.get("/subsubcategories", protect, adminOnly, getSubSubCategories);

export default router;
