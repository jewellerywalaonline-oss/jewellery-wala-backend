/**
 * @openapi
 * tags:
 *   - name: Contact
 *     description: Contact form submissions
 *
 * /api/website/contact:
 *   post:
 *     tags: [Contact]
 *     summary: Submit a contact form
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContactInput'
 *     responses:
 *       200:
 *         description: Contact form submitted
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import { contact } from "../../controller/web/contact.controller.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";
import rateLimit from "../../middleware/rateLimit.js";

const router = Router();

router.post("/", rateLimit.contact, uploadNone, contact);

export default router;
