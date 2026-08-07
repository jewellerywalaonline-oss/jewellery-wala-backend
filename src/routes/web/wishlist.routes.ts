/**
 * @openapi
 * tags:
 *   - name: Wishlist
 *     description: User wishlist operations
 *
 * /api/website/wishlist/view:
 *   get:
 *     tags: [Wishlist]
 *     summary: Get user's wishlist
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Wishlist items
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
 * /api/website/wishlist/add:
 *   post:
 *     tags: [Wishlist]
 *     summary: Add product to wishlist
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId: { type: string }
 *     responses:
 *       200:
 *         description: Product added to wishlist
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
 * /api/website/wishlist/remove/{productId}:
 *   put:
 *     tags: [Wishlist]
 *     summary: Remove product from wishlist
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product removed
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
 * /api/website/wishlist/check/{productId}:
 *   post:
 *     tags: [Wishlist]
 *     summary: Check if product is in wishlist
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Wishlist status
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
 */

import { Router } from "express";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkInWishlist,
} from "../../controller/web/wishlist.controller.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";
import protect from "../../middleware/authMiddleware.js";
import rateLimit from "../../middleware/rateLimit.js";

const router = Router();

router.get("/view", rateLimit.wishlistActions, protect, getWishlist);

router.post("/add", rateLimit.wishlistActions, protect, uploadNone, addToWishlist);

router.put("/remove/:productId", rateLimit.wishlistActions, protect, removeFromWishlist);

router.post("/check/:productId", rateLimit.wishlistActions, protect, checkInWishlist);

export default router;
