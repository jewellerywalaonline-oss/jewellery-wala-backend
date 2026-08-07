# API — Express Backend

Express 5 + MongoDB REST API for the Jewellery Walla e-commerce platform.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript (tsx for dev, tsc for build) |
| Framework | Express 5 |
| Database | MongoDB via Mongoose 8 |
| Auth | JWT (15min) + refresh tokens (7-day, httpOnly cookies) with bcrypt |
| Payments | Razorpay SDK (orders, payments, refunds, webhooks) |
| Storage | Cloudflare R2 (S3-compatible) via @aws-sdk/client-s3 |
| Email | Nodemailer (Gmail SMTP) + EJS templates |
| Cache | node-cache (in-memory, per-instance) |
| Rate Limiting | express-rate-limit |
| Validation | Zod (env & body), Mongoose (schema) |
| File Upload | multer (5MB per file, 10 files max) |
| AI | Google Gemini API (product description generation, content helpers) |
| Catalog | Categories → subcategories → sub-subcategories; products have sizes, purity (gold/silver/platinum), colors, materials |
| Shipping | In-house delivery (admin-managed order status + delivery OTP) |
| Logging | pino |
| Testing | Playwright (configured) |

## Project Structure

```
api/src/
├── server.ts            # Entry point — Express app factory
├── config/              # Env validation (Zod), Cloudflare config
├── controller/
│   ├── web/             # Customer-facing controllers (auth, orders, products, cart, wishlist, reviews)
│   └── admin/           # Admin controllers (products, orders, users, banners, CMS)
├── lib/                 # Utilities (jwt, bcrypt, cache, cloudflare, slug, nodemailer, tokens, logger)
├── middleware/           # authMiddleware (JWT verify + role check), rateLimit, uploadMiddleware
├── models/              # Mongoose schemas (25+ models: user, product, order, cart, category, subCategory, subSubCategory, size, color, material, banner, homePage, review, coupon, faq, job, etc.)
├── routes/              # Express routers (web/ and admin/ namespaces)
├── types/               # Shared TypeScript types
├── utils/               # asyncHandler, responses (success/fail helpers)
└── views/               # EJS email templates
```

## API Namespaces

| Prefix | Auth Required | Purpose |
|--------|---------------|---------|
| `/api/website/*` | Varies | Customer-facing endpoints |
| `/api/admin/*` | Admin role | Admin dashboard endpoints |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with hot reload (tsx watch) |
| `pnpm build` | TypeScript compile to `dist/` |
| `pnpm start` | Run compiled production build |
| `pnpm typecheck` | TypeScript check without emitting |
| `pnpm lint` | ESLint on src/ |
| `pnpm test` | Run Playwright tests |

## Environment Variables

Key vars in `api/.env` (gitignored). See `.env.example` for full reference:

```
NODE_ENV=development
PORT=5000
NEW_DB_URL=mongodb://localhost:27017/jewelley_walla
JWT_SECRET=your-jwt-secret-here                # ⚠️ Generate with: openssl rand -hex 64

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# URLs — both must point at the WEB STOREFRONT (:3001), not the admin panel
APP_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3001

# Brand (used in email templates, order IDs, receipts)
APP_NAME=Jewellery Walla
SUPPORT_EMAIL=support@jewellerywalla.com
EMAIL_FROM_NAME=Jewellery Walla

# Email (Gmail SMTP)
MY_GMAIL=your-email@gmail.com
MY_GMAIL_PASSWORD=your-app-password

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_ACCESS_KEY_ID=...
CLOUDFLARE_SECRET_ACCESS_KEY=...
CLOUDFLARE_BUCKET_NAME=...
CLOUDFLARE_PUBLIC_URL=...
CDN_HOST=cdn.jewellerywalla.com

# Razorpay
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Google Gemini AI
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash

# Twilio (SMS)
TWILLO_VERIFY_SERVICE_SID=...
TWILLO_ACCOUNT_SID=...
TWILLO_AUTH_TOKEN=...

# Revalidation (shared secret with web frontend)
REVALIDATE_SECRET=...
```

---

## In-House Delivery & Shipping

### Overview

This store uses an **in-house / manual delivery flow** — no external courier integration.

1. **Flat shipping fee** — `DEFAULT_SHIPPING_FEE` (₹50) is applied at checkout unless the frontend supplies a `shippingCharge`. No live courier-rate estimation.
2. **Admin-managed fulfilment** — admin marks an order `shipped` → delivers using the delivery-OTP flow.
3. **Delivery OTP** — on payment confirmation, a delivery OTP is generated (hash stored on the order, `notes.internal`). The delivery partner enters the OTP via `POST /api/website/orders/verify-delivery-otp` to mark the order `delivered`.

### Order Lifecycle (status flow)

```
pending → payment_failed / confirmed → shipped → delivered
                              ↘ cancelled / refunded
```

- `confirmed` — payment verified (online) or COD order placed
- `shipped` — admin marks shipped (`POST /api/admin/orders/mark-to-shipped`)
- `delivered` — delivery OTP verified, or admin marks delivered
- `cancelled` — customer (12h window) or admin cancellation

### Admin Delivery Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/orders/mark-to-shipped` | Mark a confirmed order as shipped |
| `POST` | `/api/admin/orders/deliever/order` | Mark an order as delivered (admin override) |
| `POST` | `/api/website/orders/send-delivery-otp` | Send/refresh the delivery OTP to the customer |
| `POST` | `/api/website/orders/verify-delivery-otp` | Verify the delivery OTP → order delivered |

### Order Data Model (shipping fields)

The `Order.shipping` subdocument:

| Field | Type | Description |
|-------|------|-------------|
| `shipping.carrier` | String | Optional courier name (informational) |
| `shipping.trackingNumber` | String | Optional reference / AWB (informational) |
| `shipping.trackingUrl` | String | Optional tracking URL (informational) |
| `shipping.estimatedDelivery` | Date | Estimated delivery date (if provided) |
| `shipping.shippedAt` | Date | Set when the order is marked shipped |
| `shipping.deliveredAt` | Date | Set when delivery is confirmed |

### Agent Skills

The following `.agents/skills/` are relevant to this project:

| Skill | Why |
|-------|-----|
| `express-production` | Express middleware order, error handling, security hardening, testing |
| `razorpay` | Razorpay payment integration (orders, refunds, webhooks) |
| `security-review` | OWASP vulnerability scanning for API auth, IDOR, injection |
| `ponytail` | Minimal-solution mode for backend refactoring |

## Deployment

```bash
# 1. Install (must be pnpm — npm cannot resolve the `link:` protocol dependency)
pnpm install --frozen-lockfile

# 2. Build TypeScript
pnpm build

# 3. Start production server
NODE_ENV=production pnpm start
```

> **Important for hosted platforms (Render):** this project is **pnpm-only**.
> - `eslint-plugin-local` is declared as `link:eslint-plugin-local`; `npm install` will fail with `EUNSUPPORTEDPROTOCOL`.
> - Set the platform **Install Command** to `pnpm install --frozen-lockfile` and **Build Command** to `pnpm build`.
> - `pnpm-lock.yaml` **must stay in sync** with `package.json` — platforms that use frozen-lockfile installs (Vercel, Render, CI) will fail with `ERR_PNPM_OUTDATED_LOCKFILE` otherwise. Regenerate with `pnpm install` and commit.
> - After a failed deploy, clear the platform's build cache before retrying — stale `node_modules` from a failed `npm install` breaks `tsc` (e.g. TS2688 missing `@types/node`).

No Dockerfile or Procfile included — deploy as a Node.js process. Recommended:
- Use a process manager (pm2, systemd) for process recovery
- Set `NODE_ENV=production` to disable hot reload and verbose error output
- Ensure all required env vars are configured (see Environment Variables above)
- Set `FRONTEND_URL` to the production frontend URL (affects CORS, Google OAuth callback, email links)

## Google OAuth

The API implements two Google OAuth flows:

| Flow | Endpoint | Auth Method |
|------|----------|-------------|
| Authorization Code (redirect) | `POST /api/website/user/google-auth-init` → `POST /api/website/user/google-callback` | User redirected to Google consent screen |
| ID Token (credential) | `POST /api/website/user/google-login` | Google One Tap / credential token |

### Authorized Redirect URIs (Google Cloud Console)

| Environment | Redirect URI |
|-------------|-------------|
| Development | `http://localhost:3001/auth/google/callback` |
| Production | `https://<YOUR_DOMAIN>/auth/google/callback` |

> The redirect URI is dynamically built from `FRONTEND_URL` env var. Whatever `FRONTEND_URL` is set to, the callback is `{FRONTEND_URL}/auth/google/callback`.

### Authorized JavaScript Origins

| Environment | Origin |
|-------------|--------|
| Development | `http://localhost:3001` |
| Production | `https://<YOUR_DOMAIN>` |

### Env Vars

| Var | Required | Notes |
|-----|----------|-------|
| `GOOGLE_CLIENT_ID` | Optional (OAuth disabled if missing) | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Optional | From Google Cloud Console |
| `FRONTEND_URL` | Required | Base URL for redirect URI construction |

### OAuth Flow (Authorization Code)

```
1. Frontend → POST /api/website/user/google-auth-init
                   → Backend generates state token (anti-CSRF, 10min TTL)
                   → Returns Google authorization URL

2. Frontend redirects user to Google consent screen
                   → User authenticates
                   → Google redirects to {FRONTEND_URL}/auth/google/callback?code=...&state=...

3. Frontend callback page → POST /api/website/user/google-callback { code, state }
                   → Backend validates state token
                   → Exchanges code for tokens via OAuth2Client
                   → Verifies ID token
                   → Finds or creates user by email/googleId
                   → Sets httpOnly session cookie
                   → Returns user data
```

## Architecture Notes

- **Auth flow**: JWT in httpOnly cookie + refresh token rotation. Middleware verifies JWT on every request.
- **Role enforcement**: `adminOnly` middleware (`requireRole('admin')`) on all admin routes. Role re-read from DB per request.
- **Error handling**: Global 4-arg error handler. `fail()` helper returns `_status`, `_message`, and `_error` in development only.
- **NoSQL injection**: Custom sanitize middleware strips `$` and `.` from body/query keys.
- **Post-payment work**: MongoDB-backed job queue (`api/src/lib/jobQueue.ts` + `api/src/models/job.ts`) with 3 job types (send-email, update-profile, update-rating), persistence across restarts, and automatic retry (up to 3×).
- **Caching**: node-cache per-instance. Cache invalidation on admin writes. Redis needed for multi-instance.
- **Brand env-ification**: `APP_NAME`, `SUPPORT_EMAIL`, `CDN_HOST`, and `EMAIL_FROM_NAME` control all brand-facing output (email templates, order ID prefixes, sender identity). No hardcoded brand strings.
- **Shipping (in-house)**: Flat fee at checkout; fulfilment is manual via admin order-status endpoints + delivery-OTP verification. No external courier dependencies.
