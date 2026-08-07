import { Router } from "express";
import {
  listProviders,
  listHistory,
  chat,
  deleteConversation,
} from "../../controller/admin/ai-agent.controller.js";
import protect, { adminOnly, csrfProtection } from "../../middleware/authMiddleware.js";
import { uploadNone } from "../../middleware/uploadMiddleware.js";
import rateLimiters from "../../middleware/rateLimit.js";

const router = Router();

// GET /api/admin/ai-agent/providers — list configured providers for the UI
router.get(
  "/providers",
  protect,
  adminOnly,
  listProviders,
);

// GET /api/admin/ai-agent/history — list past conversations
router.get(
  "/history",
  protect,
  adminOnly,
  listHistory,
);

// POST /api/admin/ai-agent/chat — streaming agent chat with provider selection
router.post(
  "/chat",
  protect,
  adminOnly,
  rateLimiters.aiAgentChat,
  csrfProtection,
  uploadNone,
  chat,
);

// DELETE /api/admin/ai-agent/history/:id — permanently delete a conversation
router.delete(
  "/history/:id",
  protect,
  adminOnly,
  csrfProtection,
  deleteConversation,
);


export default router;
