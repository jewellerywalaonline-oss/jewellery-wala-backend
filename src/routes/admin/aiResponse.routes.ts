import { Router } from "express";
import {
  createAiResponse,
  listAiResponses,
  deleteAiResponse,
} from "../../controller/admin/aiResponse.controller.js";
import protect, { adminOnly } from "../../middleware/authMiddleware.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";

const router = Router();

router.post("/create", protect, adminOnly, uploadNone, createAiResponse);
router.post("/list", protect, adminOnly, listAiResponses);
router.delete("/:id", protect, adminOnly, deleteAiResponse);

export default router;
