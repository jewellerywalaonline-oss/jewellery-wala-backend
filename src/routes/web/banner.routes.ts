/**
 * @openapi
 * tags:
 *   - name: Banners
 *     description: Website banner images with links
 *
 * /api/website/banner:
 *   get:
 *     tags: [Banners]
 *     summary: Get all active banners
 *     responses:
 *       200:
 *         description: Banner list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Banner'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import { bannerController, getBannerById } from "../../controller/web/banner.controller.js";

const router = Router();

router.get("/", bannerController);
router.get("/:id", getBannerById);

export default router;
