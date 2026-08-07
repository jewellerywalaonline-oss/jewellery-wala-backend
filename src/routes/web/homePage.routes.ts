/**
 * @openapi
 * tags:
 *   - name: Home Page
 *     description: Dynamic home page sections
 *
 * /api/website/home-page:
 *   get:
 *     tags: [Home Page]
 *     summary: Get home page sections
 *     description: Returns all configured home page sections in order
 *     responses:
 *       200:
 *         description: Home page sections
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data:
 *                   $ref: '#/components/schemas/HomePage'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import { homePageController } from "../../controller/web/homePage.controller.js";

const router = Router();

router.get("/", homePageController);

export default router;
