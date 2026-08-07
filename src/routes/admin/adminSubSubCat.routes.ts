/**
 * @openapi
 * tags:
 *   - name: Admin - SubSubCategories
 *     description: Admin sub-sub-category CRUD operations
 *
 * /api/admin/subsubcategory/view:
 *   post:
 *     tags: [Admin - SubSubCategories]
 *     summary: Get all sub-sub-categories
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Sub-sub-category list
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
 * /api/admin/subsubcategory/details/{id}:
 *   post:
 *     tags: [Admin - SubSubCategories]
 *     summary: Get sub-sub-category by ID
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
 *         description: Sub-sub-category details
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
 * /api/admin/subsubcategory/create:
 *   post:
 *     tags: [Admin - SubSubCategories]
 *     summary: Create a new sub-sub-category
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/AdminCategoryInput'
 *     responses:
 *       201:
 *         description: Sub-sub-category created
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
 * /api/admin/subsubcategory/update/{id}:
 *   put:
 *     tags: [Admin - SubSubCategories]
 *     summary: Update a sub-sub-category
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
 *             $ref: '#/components/schemas/AdminCategoryInput'
 *     responses:
 *       200:
 *         description: Sub-sub-category updated
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
 * /api/admin/subsubcategory/delete/{id}:
 *   put:
 *     tags: [Admin - SubSubCategories]
 *     summary: Soft-delete a sub-sub-category
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
 *         description: Sub-sub-category deleted
 *
 * /api/admin/subsubcategory/change-status/{id}:
 *   put:
 *     tags: [Admin - SubSubCategories]
 *     summary: Change sub-sub-category status
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
 */

import { Router } from "express";
import {
  create,
  view,
  destroy,
  details,
  update,
  changeStatus,
  restore,
} from "../../controller/admin/adminSubSubCat.contoller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";
import {
  uploadSingle,
  uploadNone,
} from "../../middleware/uploadMiddleware.js";

const router = Router();

router.post("/view", protect, adminOnly, uploadNone, view);
router.post("/details/:id", protect, adminOnly, details);
router.post("/create", protect, adminOnly, uploadSingle, create);
router.put("/update/:id", protect, adminOnly, uploadSingle, update);
router.put("/delete/:id", protect, adminOnly, uploadNone, destroy);
router.put("/change-status/:id", protect, adminOnly, uploadNone, changeStatus);
router.put("/restore/:id", protect, adminOnly, uploadNone, restore);

export default router;
