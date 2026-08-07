/**
 * @openapi
 * tags:
 *   - name: Admin - Banners
 *     description: Admin banner CRUD operations
 *
 * /api/admin/banner/create:
 *   post:
 *     tags: [Admin - Banners]
 *     summary: Create a new banner
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/AdminBannerInput'
 *     responses:
 *       201:
 *         description: Banner created
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
 * /api/admin/banner/update/{id}:
 *   put:
 *     tags: [Admin - Banners]
 *     summary: Update a banner
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
 *             $ref: '#/components/schemas/AdminBannerInput'
 *     responses:
 *       200:
 *         description: Banner updated
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
 * /api/admin/banner/delete/{id}:
 *   put:
 *     tags: [Admin - Banners]
 *     summary: Soft-delete a banner
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
 *         description: Banner deleted
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
 * /api/admin/banner/view:
 *   post:
 *     tags: [Admin - Banners]
 *     summary: Get all banners (paginated)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Banner list
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
 * /api/admin/banner/change-status:
 *   post:
 *     tags: [Admin - Banners]
 *     summary: Change banner status
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminStatusInput'
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
 * /api/admin/banner/link-options/products:
 *   get:
 *     tags: [Admin - Banners]
 *     summary: Get product link options
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Product list for banner linking
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
 * /api/admin/banner/link-options/categories:
 *   get:
 *     tags: [Admin - Banners]
 *     summary: Get category link options
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Category list for banner linking
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
 /api/admin/banner/link-options/sub-categories:
 *   get:
 *     tags: [Admin - Banners]
 *     summary: Get sub-category link options
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Sub-category list for banner linking
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
 * /api/admin/banner/link-options/sub-sub-categories:
 *   get:
 *     tags: [Admin - Banners]
 *     summary: Get sub-sub-category link options
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Sub-sub-category list for banner linking
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
  createBanner,
  updateBanner,
  deleteBanner,
  getAllBanner,
  changeStatus,
  linkOptionsProducts,
  linkOptionsCategories,
  linkOptionsSubCategories,
  linkOptionsSubSubCategories,
  restore,
} from "../../controller/admin/adminBanner.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";
import { uploadSingle, uploadNone } from "../../middleware/uploadMiddleware.js";

const router = Router();

// create banner — needs multer for image upload
router.post("/create", protect, adminOnly, uploadSingle, createBanner);
// update banner — needs multer for optional image upload
router.put("/update/:id", protect, adminOnly, uploadSingle, updateBanner);
// delete banner — no file needed
router.put("/delete/:id", protect, adminOnly, uploadNone, deleteBanner);
// get all banner — no file needed
router.post("/view", protect, adminOnly, uploadNone, getAllBanner);
// change status — no file needed
router.post("/change-status", protect, adminOnly, uploadNone, changeStatus);
router.put("/restore/:id", protect, adminOnly, uploadNone, restore);

// link-options endpoints (for cascading dropdowns in the admin form)
router.get("/link-options/products", protect, adminOnly, linkOptionsProducts);
router.get("/link-options/categories", protect, adminOnly, linkOptionsCategories);
router.get("/link-options/sub-categories", protect, adminOnly, linkOptionsSubCategories);
router.get("/link-options/sub-sub-categories", protect, adminOnly, linkOptionsSubSubCategories);

export default router;
