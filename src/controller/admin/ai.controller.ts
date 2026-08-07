import type { Request, Response } from "express";
import { generateText } from "ai";
import {
  resolveModel,
  listConfiguredProviders,
  type AiProviderName,
  registry,
} from "../../lib/ai-providers.js";

const configuredProvider = (): AiProviderName | null => {
  const providers = listConfiguredProviders();
  return providers.length > 0 ? providers[0] ?? null : null;
};
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import AiResponse from "../../models/aiResponse.js";
/// <reference path="../../types/express.d.ts" />

// ── Provider helpers ────────────────────────────────────────────────



const NOT_CONFIGURED = {
  _status: false,
  _message: "AI is not configured on the server",
} as const;

async function generateWithProvider(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const model = resolveModel();
  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.5,
    maxOutputTokens: 2048,
  });
  return text.trim();
}

/**
 * Generate content based on the request context.
 * Detects whether the request is for a product description or FAQ answer
 * and uses the appropriate system + user prompts.
 */
async function generateContent(input: {
  name: string;
  category?: string;
  material?: string;
  type?: string;
  price?: string;
  page?: string;
  question?: string;
}): Promise<string> {
  const { name, category, material, type, price, page, question } = input;

  // ── FAQ Answer Generation ────────────────────────────────────────
  if (question && page === "faq-answer") {
    const system = `You are a helpful product support assistant for a jewellery store.
Output ONLY the answer to the question. Never include planning, reasoning, word counts, suggestions, or any commentary outside the answer.
Write in plain, helpful language. No emojis. No bullet points. No markdown formatting.
Keep the answer concise — 2 to 4 sentences.`;

    const user = `Answer this customer question about the product "${name}":

Question: ${question}`;

    return generateWithProvider(system, user);
  }

  // ── Product Description Generation ────────────────────────────────
  const system = `You are a senior e-commerce copywriter for a jewellery store.
Output ONLY the product description. Never include planning, reasoning, word counts, suggestions, or any commentary outside the description.
Write in plain, natural language. No emojis. No bullet points. No asterisks or markdown formatting.
Separate paragraphs with a blank line (double newline).
Output ONLY the final description — nothing else before or after.`;

  const user = `Write a product description (120-180 words, exactly 3 paragraphs separated by blank lines) for:

Product name: ${name}
Category: ${category || "N/A"}
Material: ${material || "N/A"}
Type: ${type || "N/A"}
Price: ₹${price || "N/A"}

Paragraph 1: Age group and play value
Paragraph 2: Features and educational benefits
Paragraph 3: Safety and care instructions`;

  return generateWithProvider(system, user);
}

/**
 * GET /api/admin/ai/health
 * Returns per-provider status without consuming tokens.
 */
export const checkAiHealth = async (
  _req: Request,
  res: Response,
): Promise<Response> => {
  const providers = listConfiguredProviders();

  // Run reachability checks in parallel
  const statuses = await Promise.all(
    (Object.keys(registry) as AiProviderName[]).map(async (name) => {
      const def = registry[name];
      if (!def.isConfigured()) {
        return { provider: name, configured: false, reachable: false };
      }

      let reachable = false;
      let checkError: string | null = null;
      let keyLabel: string | null = null;

      try {
        if (name === "openrouter") {
          const keyRes = await fetch(
            "https://openrouter.ai/api/v1/key",
            { headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY!}` } },
          );
          if (keyRes.ok) {
            reachable = true;
            const keyData = (await keyRes.json()) as {
              label?: string;
            } | null;
            keyLabel = keyData?.label || null;
          } else {
            const errBody = await keyRes.text().catch(() => "");
            checkError = `API key check failed (${keyRes.status}): ${errBody}`;
          }
        } else {
          // Gemini / LLM7 / HuggingFace have no cost-free ping — assume configured = reachable
          reachable = true;
        }
      } catch (err) {
        checkError = err instanceof Error ? err.message : String(err);
      }

      return {
        provider: name,
        configured: true,
        reachable,
        model: def.defaultModel,
        ...(keyLabel ? { keyLabel } : {}),
        ...(checkError ? { error: checkError } : {}),
      };
    }),
  );

  const configuredCount = providers.length;
  const configuredProvider = providers[0] || null;

  return res.status(200).json({
    _status: true,
    _message:
      configuredCount > 0
        ? `${configuredCount} AI provider(s) configured`
        : "No AI providers configured",
    _data: {
      configured: configuredCount > 0,
      provider: configuredProvider || env.AI_PROVIDER,
      providers: statuses,
      activeProvider: configuredProvider || null,
    },
  });
};

/**
 * POST /api/admin/ai/generate-description
 * Body: { name, category, material, purity, price, page? }
 * Returns: { _status: true, _data: { text: "..." } }
 */
export const generateProductDescription = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { name, category, material, type, price, page, question } =
      req.body as {
        name?: string;
        category?: string;
        material?: string;
        type?: string;
        price?: string;
        page?: string;
        question?: string;
      };

    if (!name) {
      return res.status(400).json({
        _status: false,
        _message: "Product name is required",
      });
    }

    if (!configuredProvider()) {
      return res.status(503).json(NOT_CONFIGURED);
    }

    const text = await generateContent({
      name,
      category,
      material,
      type,
      price,
      page,
      question,
    });

    // Save to history — non-blocking
    try {
      await AiResponse.create({
        prompt: `${name} | ${page || "product-description"}`,
        response: text,
        page: page || "product-description",
        adminId: req.user?._id,
      });
    } catch (saveErr) {
      logger.error({ err: saveErr }, "Failed to save AI response to history");
    }

    return res.status(200).json({
      _status: true,
      _message: "Description generated",
      _data: { text },
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to generate description. Please try again.";
    logger.error({ err }, "Error generating product description");
    return res.status(500).json({
      _status: false,
      _message: message,
    });
  }
};

/**
 * POST /api/admin/ai/generate-faq-answer
 * Body: { name, question }
 * Returns: { _status: true, _data: { text: "..." } }
 */
export const generateFaqAnswer = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { name, question } = req.body as {
      name?: string;
      question?: string;
    };

    if (!name) {
      return res.status(400).json({
        _status: false,
        _message: "Product name is required",
      });
    }

    if (!question) {
      return res.status(400).json({
        _status: false,
        _message: "Question is required",
      });
    }

    if (!configuredProvider()) {
      return res.status(503).json(NOT_CONFIGURED);
    }

    const system = `You are a helpful product support assistant for a jewellery store.
Output ONLY the answer to the question. Never include planning, reasoning, word counts, suggestions, or any commentary outside the answer.
Write in plain, helpful language. No emojis. No bullet points. No markdown formatting.
Keep the answer concise — 2 to 4 sentences.`;

    const user = `Answer this customer question about the product "${name}":

Question: ${question}`;

    const text = await generateWithProvider(system, user);

    // Save to history — non-blocking
    try {
      await AiResponse.create({
        prompt: `${name} | ${question.slice(0, 60)}`,
        response: text,
        page: "faq-answer",
        adminId: req.user?._id,
      });
    } catch (saveErr) {
      logger.error({ err: saveErr }, "Failed to save AI response to history");
    }

    return res.status(200).json({
      _status: true,
      _message: "FAQ answer generated",
      _data: { text },
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to generate FAQ answer. Please try again.";
    logger.error({ err }, "Error generating FAQ answer");
    return res.status(500).json({
      _status: false,
      _message: message,
    });
  }
};

/**
 * POST /api/admin/ai/generate-general-faq-answer
 * Body: { question }
 * Returns: { _status: true, _data: { text: "..." } }
 */
export const generateGeneralFaqAnswer = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { question } = req.body as { question?: string };

    if (!question) {
      return res.status(400).json({
        _status: false,
        _message: "Question is required",
      });
    }

    if (!configuredProvider()) {
      return res.status(503).json(NOT_CONFIGURED);
    }

    const system = `You are a helpful customer support writer for a jewellery store.
Output ONLY the answer to the question. Never include planning, reasoning, word counts, or any commentary outside the answer.
Write in plain, helpful language. No emojis. No bullet points. No markdown formatting.
Keep the answer informative but concise — 2 to 5 sentences.`;

    const user = `Answer this frequently asked question:

Question: ${question}`;

    const text = await generateWithProvider(system, user);

    // Save to history — non-blocking
    try {
      await AiResponse.create({
        prompt: `General FAQ | ${question.slice(0, 60)}`,
        response: text,
        page: "other",
        adminId: req.user?._id,
      });
    } catch (saveErr) {
      logger.error({ err: saveErr }, "Failed to save AI response to history");
    }

    return res.status(200).json({
      _status: true,
      _message: "FAQ answer generated",
      _data: { text },
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to generate FAQ answer. Please try again.";
    logger.error({ err }, "Error generating FAQ answer");
    return res.status(500).json({
      _status: false,
      _message: message,
    });
  }
};

/**
 * POST /api/admin/ai/generate-short-description
 * Body: { name, category, material, type, price }
 * Returns: { _status: true, _data: { text: "..." } }
 */
export const generateShortDescription = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { name, category, material, type, price } = req.body as {
      name?: string;
      category?: string;
      material?: string;
      type?: string;
      price?: string;
    };

    if (!name) {
      return res.status(400).json({
        _status: false,
        _message: "Product name is required",
      });
    }

    if (!configuredProvider()) {
      return res.status(503).json(NOT_CONFIGURED);
    }

    const system = `You are a senior e-commerce copywriter for a jewellery store.
Output ONLY the short description. Never include planning, reasoning, word counts, or any commentary outside the description.
Write in plain, natural language. No emojis. No bullet points. No markdown formatting.
Keep it to 1-2 concise sentences (15-30 words).
Output ONLY the final short description — nothing else before or after.`;

    const user = `Write a very short product description (1-2 sentences, 15-30 words) for:

Product name: ${name}
Category: ${category || "N/A"}
Material: ${material || "N/A"}
Type: ${type || "N/A"}
Price: ₹${price || "N/A"}

Focus on what makes this product special for kids — key benefit and play value.`;

    const text = await generateWithProvider(system, user);

    // Save to history — non-blocking
    try {
      await AiResponse.create({
        prompt: `${name} | short-description`,
        response: text,
        page: "other",
        adminId: req.user?._id,
      });
    } catch (saveErr) {
      logger.error({ err: saveErr }, "Failed to save AI response to history");
    }

    return res.status(200).json({
      _status: true,
      _message: "Short description generated",
      _data: { text },
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to generate short description. Please try again.";
    logger.error({ err }, "Error generating short description");
    return res.status(500).json({
      _status: false,
      _message: message,
    });
  }
};

/**
 * POST /api/admin/ai/generate-tags
 * Body: { name, description }
 * Returns: { _status: true, _data: { text: "tag1, tag2, tag3" } }
 */
export const generateProductTags = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { name, description } = req.body as {
      name?: string;
      description?: string;
    };

    if (!name) {
      return res.status(400).json({
        _status: false,
        _message: "Product name is required",
      });
    }

    if (!configuredProvider()) {
      return res.status(503).json(NOT_CONFIGURED);
    }

    const systemPrompt =
      "You are an e-commerce SEO specialist for a jewellery store. Return ONLY a comma-separated list of tags, nothing else.";

    const userPrompt = `Generate 5-10 relevant, single-word or short-phrase tags for the following product.

Product name: ${name}
Description: ${description || "N/A"}

Rules:
- Each tag should be lowercase, single words preferred.
- Tags should describe: the jewellery type, material, purity, occasion, and key features.
- No duplicates.
- Example output: "gold, ring, solitaire, bridal, 22k, gift"`;

    const text = await generateWithProvider(systemPrompt, userPrompt);

    // Save to history — non-blocking
    try {
      await AiResponse.create({
        prompt: userPrompt,
        response: text,
        page: "product-tags",
        adminId: req.user?._id,
      });
    } catch (saveErr) {
      logger.error({ err: saveErr }, "Failed to save AI response to history");
    }

    return res.status(200).json({
      _status: true,
      _message: "Tags generated",
      _data: { text },
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to generate tags. Please try again.";
    logger.error({ err }, "Error generating product tags");
    return res.status(500).json({
      _status: false,
      _message: message,
    });
  }
};
