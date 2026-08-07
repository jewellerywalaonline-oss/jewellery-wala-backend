/**
 * @openapi
 * tags:
 *   - name: Product FAQs
 *     description: Product-specific frequently asked questions
 *
 * /api/website/product-faq:
 *   get:
 *     tags: [Product FAQs]
 *     summary: Get all product FAQs
 *     responses:
 *       200:
 *         description: Product FAQ list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductFAQ'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import { productFaqController } from "../../controller/web/productFaq.controller.js";

const router = Router();

router.get("/", productFaqController);

export default router;
