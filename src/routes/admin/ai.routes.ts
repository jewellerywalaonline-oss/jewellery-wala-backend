import { Router } from "express";
import {
  generateProductDescription,
  generateProductTags,
  generateFaqAnswer,
  generateShortDescription,
  generateGeneralFaqAnswer,
  checkAiHealth,
} from "../../controller/admin/ai.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";

const router = Router();

router.get(
  "/health",
  protect,
  adminOnly,
  checkAiHealth,
);

router.post(
  "/generate-description",
  protect,
  adminOnly,
  uploadNone,
  generateProductDescription,
);

router.post(
  "/generate-tags",
  protect,
  adminOnly,
  uploadNone,
  generateProductTags,
);

router.post(
  "/generate-faq-answer",
  protect,
  adminOnly,
  uploadNone,
  generateFaqAnswer,
);

router.post(
  "/generate-short-description",
  protect,
  adminOnly,
  uploadNone,
  generateShortDescription,
);

router.post(
  "/generate-general-faq-answer",
  protect,
  adminOnly,
  uploadNone,
  generateGeneralFaqAnswer,
);

export default router;
