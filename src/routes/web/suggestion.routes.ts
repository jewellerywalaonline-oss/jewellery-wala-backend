/**
 * @openapi
 * tags:
 *   - name: Search
 *     description: Product search with suggestions
 *
 * /api/website/result/suggestion:
 *   get:
 *     tags: [Search]
 *     summary: Search products with autocomplete suggestions
 *     description: Rate-limited to 60 requests/minute per IP
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _status: { type: boolean, example: true }
 *                 _data:
 *                   $ref: '#/components/schemas/SuggestionResponse'
 *       429:
 *         description: Too many requests - rate limited to 60/min
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InternalError'
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getSearchWithSuggestions } from "../../controller/web/suggestion.controller.js";

const router = Router();

// Rate-limited search endpoint (60 requests per minute per IP)
const suggestionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { _status: false, _message: "Too many search requests, please slow down" },
});

router.get("/suggestion", suggestionLimiter, getSearchWithSuggestions);

export default router;
