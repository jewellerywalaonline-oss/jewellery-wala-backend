/**
 * @openapi
 * tags:
 *   - name: Navigation
 *     description: Category navigation hierarchy
 *
 * /api/website/nav:
 *   get:
 *     tags: [Navigation]
 *     summary: Get full category navigation tree
 *     description: Returns categories with nested sub-categories and sub-sub-categories for site navigation
 *     responses:
 *       200:
 *         description: Navigation data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data:
 *                   $ref: '#/components/schemas/NavigationData'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import { navController } from "../../controller/web/nav.controller.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";

const router = Router();

router.get("/", uploadNone, navController);

export default router;
