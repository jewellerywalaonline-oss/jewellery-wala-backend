import { z } from "zod";
import "dotenv/config";
import { logger } from "../lib/logger.js";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  APP_URL: z.string().url().default("http://localhost:3001"),
  FRONTEND_URL: z.string().url().default("http://localhost:3001"),

  MY_GMAIL: z.string().email().optional(),
  MY_GMAIL_PASSWORD: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  SUPPORT_EMAIL: z.string().email().default("support@jewellerywalla.com"),
  CDN_HOST: z.string().default("cdn.jewellerywalla.com"),
  APP_NAME: z.string().default("Jewellery Walla"),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  NEW_DB_URL: z.string().min(1, "NEW_DB_URL is required"),

  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_SECRET_ACCESS_KEY: z.string().optional(),
  R2_API_TOKEN: z.string().optional(),

  CLOUDFLARE_BUCKET_NAME: z.string().optional(),
  CLOUDFLARE_PUBLIC_URL: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  // Set to the dev domain from your Resend dashboard (e.g. "acme_123@resend.dev")
  // until you verify a custom domain, then switch to your verified domain.
  RESEND_FROM_EMAIL: z
    .string()
    .email()
    .default("noreply@resend.dev"),

  AI_PROVIDER: z.enum(["gemini", "openrouter", "llm7", "huggingface"]).default("openrouter"),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openrouter/free"),

  LLM7_API_KEY: z.string().optional(),
  LLM7_BASE_URL: z.string().optional(),
  LLM7_MODEL: z.string().default("gpt-4o-mini-2024-07-18"),

  HUGGINGFACE_API_KEY: z.string().optional(),
  HUGGINGFACE_BASE_URL: z.string().optional(),
  HUGGINGFACE_MODEL: z.string().default("meta-llama/Llama-3.3-70B-Instruct"),

  AI_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().default(100000),

  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3001")
    .transform((val) => val.split(",").map((s) => s.trim())),

  STORE_PICKUP_PINCODE: z.string().default("342005"),

  // ── Financial defaults ──
  DEFAULT_SHIPPING_FEE: z.coerce.number().int().nonnegative().default(50),
  DEFAULT_GIFT_WRAP_FEE: z.coerce.number().int().nonnegative().default(50),
  COD_ADVANCE_MIN: z.coerce.number().int().nonnegative().default(100),
  COD_ADVANCE_PERCENT: z.coerce.number().min(0).max(100).default(10),
  AUTO_DISCOUNT_THRESHOLD: z.coerce.number().int().nonnegative().default(500),
  AUTO_DISCOUNT_PERCENT: z.coerce.number().min(0).max(100).default(5),

  TURNSTILE_SECRET_KEY: z.string().optional(),

  // LocationIQ reverse-geocoding — used by the checkout geolocation auto-fill.
  // Optional: the feature is disabled gracefully when the key is missing.
  LOCATIONIQ_API_KEY: z.string().min(1).optional(),

  REVALIDATE_SECRET: z.string().optional(),

  ENABLE_SWAGGER: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error({ errors: parsed.error.flatten().fieldErrors }, "Invalid environment variables");
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;