/**
 * @openapi
 * tags:
 *   - name: Admin - Products
 *     description: Admin product CRUD operations
 *
 * /api/admin/product/create:
 *   post:
 *     tags: [Admin - Products]
 *     summary: Create a new product
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/AdminProductInput'
 *     responses:
 *       201:
 *         description: Product created
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
 * /api/admin/product/view:
 *   post:
 *     tags: [Admin - Products]
 *     summary: Get all products (paginated)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Product list with pagination
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
 * /api/admin/product/details/{id}:
 *   post:
 *     tags: [Admin - Products]
 *     summary: Get product by ID
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product details
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
 * /api/admin/product/update/{id}:
 *   put:
 *     tags: [Admin - Products]
 *     summary: Update a product
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/AdminProductInput'
 *     responses:
 *       200:
 *         description: Product updated
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
 * /api/admin/product/delete/{id}:
 *   put:
 *     tags: [Admin - Products]
 *     summary: Soft-delete a product
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product deleted
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
 * /api/admin/product/change-status/{id}:
 *   put:
 *     tags: [Admin - Products]
 *     summary: Change product status
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Status changed
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
 * /api/admin/product/update-stock/{id}:
 *   put:
 *     tags: [Admin - Products]
 *     summary: Update product stock quantity
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stock: { type: integer }
 *     responses:
 *       200:
 *         description: Stock updated
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
 * /api/admin/product/get-by-category/{categorySlug}/{subCategorySlug}/{subSubCategorySlug}:
 *   post:
 *     tags: [Admin - Products]
 *     summary: Get products by category hierarchy
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
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
 *     responses:
 *       200:
 *         description: Products fetched
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
 * /api/admin/product/get-by-filter:
 *   post:
 *     tags: [Admin - Products]
 *     summary: Filter products by various criteria
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Filtered products
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
  create,
  view,
  destroy,
  getOne,
  getByCategory,
  getProductByFilter,
  updateStock,
  update,
  changeStatus,
  restore,
} from "../../controller/admin/adminProduct.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";
import {
  uploadNone,
  uploadProduct,
} from "../../middleware/uploadMiddleware.js";

const router = Router();

router.post("/create", protect, adminOnly, uploadProduct, create);
router.post("/view", protect, adminOnly, uploadNone, view);
router.post("/details/:id", protect, adminOnly, getOne);
router.put("/update/:id", protect, adminOnly, uploadProduct, update);
router.put("/delete/:id", protect, adminOnly, uploadNone, destroy);
router.put("/change-status/:id", protect, adminOnly, uploadNone, changeStatus);
router.put("/update-stock/:id", protect, adminOnly, uploadNone, updateStock);
router.put("/restore/:id", protect, adminOnly, uploadNone, restore);
router.post(
  "/get-by-category/:categorySlug/:subCategorySlug/:subSubCategorySlug",
  protect,
  uploadNone,
  getByCategory,
);
router.post("/get-by-filter", protect, adminOnly, uploadNone, getProductByFilter);

export default router;
