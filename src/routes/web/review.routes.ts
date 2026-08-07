/**
 * @openapi
 * tags:
 *   - name: Reviews
 *     description: Product reviews
 *
 * /api/website/review/create:
 *   post:
 *     tags: [Reviews]
 *     summary: Create a product review
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReviewInput'
 *     responses:
 *       201:
 *         description: Review created
 *       401:
 *         description: Not authorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 *
 * /api/website/review/get/{productId}:
 *   get:
 *     tags: [Reviews]
 *     summary: Get reviews for a product
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product reviews with average rating
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import { createReview, getReviewsByProduct } from "../../controller/web/review.controller.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";
import protect from "../../middleware/authMiddleware.js";
import rateLimit from "../../middleware/rateLimit.js";

const router = Router();

router.post("/create", rateLimit.createReview, uploadNone, protect, createReview);
router.get("/get/:productId", getReviewsByProduct);

export default router;
