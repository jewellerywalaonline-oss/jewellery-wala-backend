import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "../config/env.js";
import type { LanguageModel } from "ai";

export type AiProviderName = "gemini" | "openrouter" | "llm7" | "huggingface";

interface ProviderDef {
  isConfigured: () => boolean;
  getModel: (modelId?: string) => LanguageModel;
  defaultModel: string;
}

const registry: Record<AiProviderName, ProviderDef> = {
  gemini: {
    isConfigured: () => !!env.GEMINI_API_KEY,
    getModel: (id) => google(id || env.GEMINI_MODEL || "gemini-2.5-flash"),
    defaultModel: "gemini-2.5-flash",
  },
  openrouter: {
    isConfigured: () => !!env.OPENROUTER_API_KEY,
    getModel: (id) =>
      createOpenRouter({ apiKey: env.OPENROUTER_API_KEY! })(
        id || env.OPENROUTER_MODEL || "openrouter/free",
      ),
    defaultModel: "openrouter/free",
  },
  llm7: {
    // Always available — free tier uses api_key="unused" if none configured
    isConfigured: () => true,
    getModel: (id) =>
      createOpenAICompatible({
        name: "llm7",
        baseURL: env.LLM7_BASE_URL || "https://api.llm7.io/v1",
        apiKey: env.LLM7_API_KEY || "unused",
      }).chatModel(id || env.LLM7_MODEL || "gpt-4o-mini-2024-07-18"),
    defaultModel: "gpt-4o-mini-2024-07-18",
  },
  huggingface: {
    isConfigured: () => !!env.HUGGINGFACE_API_KEY,
    getModel: (id) =>
      createOpenAICompatible({
        name: "huggingface",
        baseURL: env.HUGGINGFACE_BASE_URL || "https://router.huggingface.co/v1",
        apiKey: env.HUGGINGFACE_API_KEY!,
      }).chatModel(
        id || env.HUGGINGFACE_MODEL || "meta-llama/Llama-3.3-70B-Instruct",
      ),
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct",
  },
};

/** Returns provider names that have a configured API key, in registry order. */
export function listConfiguredProviders(): AiProviderName[] {
  return (Object.keys(registry) as AiProviderName[]).filter((p) =>
    registry[p].isConfigured(),
  );
}

/**
 * Resolves a model instance. Falls back through: explicit arg → env.AI_PROVIDER →
 * first configured provider in registry order. Throws if none are configured.
 */
export function resolveModel(
  providerName?: AiProviderName,
  modelId?: string,
): LanguageModel {
  const name =
    providerName ||
    (env.AI_PROVIDER as AiProviderName) ||
    listConfiguredProviders()[0];
  const def = registry[name];
  if (!def || !def.isConfigured()) {
    throw new Error(
      `AI provider "${name}" is not configured (missing API key)`,
    );
  }
  return def.getModel(modelId);
}

export { registry };
