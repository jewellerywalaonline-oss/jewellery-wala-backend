import express, { raw } from "express";
import mongoose from "mongoose";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

import "dotenv/config";
import { env } from "./config/env.js";
import { swaggerSpec } from "./config/swagger.js";
import { logger } from "./lib/logger.js";
import { recoverStuckJobs } from "./lib/jobQueue.js";

import userRoutes from "./routes/web/user.route.js";
import productRoutes from "./routes/web/product.routes.js";
import cartRoutes from "./routes/web/cart.routes.js";
import wishlistRoutes from "./routes/web/wishlist.routes.js";
import navRoutes from "./routes/web/nav.routes.js";
import faqRoutes from "./routes/web/faq.routes.js";
import testimonialRoutes from "./routes/web/testimonial.routes.js";
import logoRoutes from "./routes/web/logo.routes.js";
import bannerRoutes from "./routes/web/banner.routes.js";
import reviewRoutes from "./routes/web/review.routes.js";
import whyChooseUsRoutes from "./routes/web/whyChooseUs.routes.js";
import webColorRoutes from "./routes/web/color.routes.js";
import webMaterialRoutes from "./routes/web/material.routes.js";
import orderRoutes from "./routes/web/order.routes.js";
import contactRoutes from "./routes/web/contact.routes.js";
import suggestionRoutes from "./routes/web/suggestion.routes.js";
import coupenRoutes from "./routes/web/coupen.routes.js";
import productFaqRoutes from "./routes/web/productFaq.routes.js";
import homePageRoutes from "./routes/web/homePage.routes.js";
import locationRoutes from "./routes/web/location.routes.js";
import materialRoutes from "./routes/admin/material.routes.js";
import colorRoutes from "./routes/admin/color.routes.js";
import sizeRoutes from "./routes/admin/size.routes.js";
import userAdminRoutes from "./routes/admin/userAdmin.routes.js";
import adminCategoryRoutes from "./routes/admin/adminCategory.routes.js";
import adminSubCategoryRoutes from "./routes/admin/adminSubCat.routes.js";
import adminSubSubCategoryRoutes from "./routes/admin/adminSubSubCat.routes.js";
import adminFaqRoutes from "./routes/admin/adminFaq.routes.js";
import adminBannerRoutes from "./routes/admin/adminBanner.routes.js";
import adminTestimonialRoutes from "./routes/admin/adminTestimonial.routes.js";
import adminLogoRoutes from "./routes/admin/adminLogo.routes.js";
import adminProductRoutes from "./routes/admin/adminProduct.routes.js";
import adminReviewRoutes from "./routes/admin/adminReview.routes.js";
import adminWhyChooseUsRoutes from "./routes/admin/adminWhyChooseUs.routes.js";
import dashboardRoutes from "./routes/admin/dashboard.routes.js";
import adminOrderRoutes from "./routes/admin/adminOrder.routes.js";
import adminBannerLinkOptionsRoutes from "./routes/admin/adminBannerLinkOptions.routes.js";
import adminProductFaqRoutes from "./routes/admin/adminProductFaq.routes.js";
import homePageAdminRoutes from "./routes/admin/homePage.routes.js";
import aiRoutes from "./routes/admin/ai.routes.js";
import aiResponseRoutes from "./routes/admin/aiResponse.routes.js";
// ── AI AGENT (disabled for Jewellery Walla) ────────────────────────────────
// The autonomous AI agent feature is intentionally disabled on this branch.
// To re-enable, uncomment the import below AND the three `ai-agent` markers
// further down (compression filter + route mount), and restore the admin nav
// items in `admin-panel/lib/nav-items.ts`.
// import aiAgentRoutes from "./routes/admin/ai-agent.routes.js";
import auditLogRoutes from "./routes/admin/auditLog.routes.js";
import settingsRoutes from "./routes/admin/settings.routes.js";
import cascadeDeleteRoutes from "./routes/admin/cascadeDelete.routes.js";
import { getCsrfToken } from "./controller/csrf.controller.js";

// Hoisted body-parser instances — created once at startup, reused on every request
const urlencodedParser = express.urlencoded({ extended: true, limit: "1mb" });
const jsonParser = express.json({ limit: "1mb" });
const rawJsonParser = raw({ type: "application/json" });

const app = express();

// Trust the X-Forwarded-For header set by the Next.js rewrite proxy.
// Without this, express-rate-limit sees the proxy's IP (127.0.0.1) for every
// request and cannot accurately identify users, triggering a validation warning.
app.set("trust proxy", 1);

app.use(
  helmet({
    // Disable browser-only protections — not relevant for a JSON API
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    referrerPolicy: false,
    xDnsPrefetchControl: false,
    xDownloadOptions: false,
    xFrameOptions: false,
    xPermittedCrossDomainPolicies: false,
    // Keep: strictTransportSecurity (HSTS), xContentTypeOptions (nosniff),
    //       hidePoweredBy (strip X-Powered-By), xXssProtection (=0)
  }),
);

app.use(
  cors({
    origin: env.CORS_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
    credentials: true,
  }),
);

// Skip compression for streaming AI agent responses (buffering kills SSE/NDJSON streaming)
// ── AI AGENT (disabled) — the `/api/admin/ai-agent/chat` streaming exemption
// is only needed when the AI agent is enabled. See import at top of file.
app.use(compression({
  filter: (req, res) => {
    // if (req.path === "/api/admin/ai-agent/chat") {
    //   return false;
    // }
    // Use default filter for everything else
    return compression.filter(req, res);
  },
}));


app.use(urlencodedParser);

app.use(cookieParser());

type Sanitizable = string | number | boolean | null | undefined | Record<string, unknown> | unknown[];

function sanitize(obj: Sanitizable): Sanitizable {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map((item) => sanitize(item as Sanitizable));
  return Object.keys(obj as Record<string, unknown>).reduce<Record<string, unknown>>((acc, key) => {
    const k = key.replace(/^\$/, "").replace(/\./g, "");
    acc[k] = sanitize((obj as Record<string, unknown>)[key] as Sanitizable);
    return acc;
  }, {});
}

app.use((req, res, next) => {
  if (req.originalUrl === "/api/website/orders/webhooks/razorpay") {
    rawJsonParser(req, res, next);
  } else {
    jsonParser(req, res, next);
  }
});

// Body sanitization — runs after all body parsers so JSON bodies are sanitized too.
// Skips Buffer bodies (e.g. webhook raw payload) to avoid corrupting binary data.
app.use((req, _res, next) => {
  if (req.body && !Buffer.isBuffer(req.body)) {
    req.body = sanitize(req.body) as typeof req.body;
  }
  const q = sanitize(req.query);
  try { Object.defineProperty(req, "query", { value: q, configurable: true }); } catch {
    // non-configurable query — ignore
  }
  next();
});

app.use("/api/website/logo", logoRoutes);
app.use("/api/website/banner", bannerRoutes);
app.use("/api/website/nav", navRoutes);
app.use("/api/website/user", userRoutes);
app.use("/api/website/product", productRoutes);
app.use("/api/website/cart", cartRoutes);
app.use("/api/website/wishlist", wishlistRoutes);
app.use("/api/website/faq", faqRoutes);
app.use("/api/website/testimonial", testimonialRoutes);
app.use("/api/website/whyChooseUs", whyChooseUsRoutes);
app.use("/api/website/review", reviewRoutes);
app.use("/api/website/color", webColorRoutes);
app.use("/api/website/material", webMaterialRoutes);
app.use("/api/website/orders", orderRoutes);
app.use("/api/website/contact", contactRoutes);
app.use("/api/website/result", suggestionRoutes);
app.use("/api/website/coupen", coupenRoutes);
app.use("/api/website/product-faq", productFaqRoutes);
app.use("/api/website/home-page", homePageRoutes);
app.use("/api/website/location", locationRoutes);

// ── Swagger Docs ──
// Available in all environments in development; in production only when ENABLE_SWAGGER=true
if (env.NODE_ENV === "development" || env.ENABLE_SWAGGER === true) {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: `${env.APP_NAME} API Docs`,
    customCss: ".swagger-ui .topbar { display: none }",
  }));
  app.get("/api/docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
  logger.info("📖 Swagger docs available at /api/docs");
}

app.use("/api/admin/logo", adminLogoRoutes);
app.use("/api/admin/banner", adminBannerRoutes);
app.use("/api/admin/user", userAdminRoutes);
app.use("/api/admin/category", adminCategoryRoutes);
app.use("/api/admin/subcategory", adminSubCategoryRoutes);
app.use("/api/admin/subsubcategory", adminSubSubCategoryRoutes);
app.use("/api/admin/product", adminProductRoutes);
app.use("/api/admin/color", colorRoutes);
app.use("/api/admin/material", materialRoutes);
app.use("/api/admin/size", sizeRoutes);
app.use("/api/admin/faq", adminFaqRoutes);
app.use("/api/admin/testimonial", adminTestimonialRoutes);
app.use("/api/admin/review", adminReviewRoutes);
app.use("/api/admin/whyChooseUs", adminWhyChooseUsRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/admin/banner-link-options", adminBannerLinkOptionsRoutes);
app.use("/api/admin/product-faq", adminProductFaqRoutes);
app.use("/api/admin/home-page", homePageAdminRoutes);
app.use("/api/admin/audit-log", auditLogRoutes);
app.use("/api/admin/settings", settingsRoutes);
app.use("/api/admin/ai", aiRoutes);
app.use("/api/admin/ai-response", aiResponseRoutes);
app.use("/api/admin/utils", cascadeDeleteRoutes);
// ── AI AGENT (disabled for Jewellery Walla) — see import at top of file
// app.use("/api/admin/ai-agent", aiAgentRoutes);
app.get("/api/admin/csrf-token", getCsrfToken);

app.get("/", (_req, res) => {
  res.send("server started");
});

// 404 handler — must be after all routes
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ success: false, message: "Internal server error" });
});

const PORT = env.PORT;
mongoose
  .connect(env.NEW_DB_URL)
  .then(() => {
    logger.info("Connected to MongoDB");
    recoverStuckJobs();
    app.listen(PORT, () => {
      logger.info({ port: PORT }, "Server started");
    });
  })
  .catch((err) => {
    logger.error({ err }, "MongoDB connection error");
    process.exit(1);
  });

export default app;
