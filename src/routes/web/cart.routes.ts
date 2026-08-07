/**
 * @openapi
 * tags:
 *   - name: Cart
 *     description: Shopping cart operations
 *
 * components:
 *   schemas:
 *     AddToCartInput:
 *       type: object
 *       required: [productId, colorId]
 *       properties:
 *         productId: { type: string }
 *         quantity: { type: integer, minimum: 1, default: 1 }
 *         colorId: { type: string }
 *     UpdateCartItemInput:
 *       type: object
 *       required: [quantity]
 *       properties:
 *         quantity: { type: integer, minimum: 1 }
 *
 * /api/website/cart/view:
 *   get:
 *     tags: [Cart]
 *     summary: Get user's cart
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Cart contents
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
 * /api/website/cart/add:
 *   post:
 *     tags: [Cart]
 *     summary: Add item to cart
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddToCartInput'
 *     responses:
 *       200:
 *         description: Item added
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
 * /api/website/cart/items/update/{itemId}:
 *   put:
 *     tags: [Cart]
 *     summary: Update cart item quantity
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCartItemInput'
 *     responses:
 *       200:
 *         description: Cart updated
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
 * /api/website/cart/items/remove/{itemId}:
 *   put:
 *     tags: [Cart]
 *     summary: Remove item from cart
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Item removed
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
 * /api/website/cart/destroy:
 *   put:
 *     tags: [Cart]
 *     summary: Clear entire cart
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared
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
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  removeFromCartByProduct,
  clearCart,
} from "../../controller/web/cart.controller.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";
import protect from "../../middleware/authMiddleware.js";
import rateLimit from "../../middleware/rateLimit.js";

const router = Router();

router.get("/view", rateLimit.cartActions, protect, getCart);

router.post("/add", rateLimit.cartActions, protect, uploadNone, addToCart);

router.put("/items/update/:itemId", rateLimit.cartActions, protect, uploadNone, updateCartItem);

router.put("/items/remove/:itemId", rateLimit.cartActions, protect, removeFromCart);

router.post("/remove-by-product", rateLimit.cartActions, protect, removeFromCartByProduct);

router.put("/destroy", rateLimit.cartActions, protect, clearCart);

export default router;
