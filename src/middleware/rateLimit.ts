import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";

interface RateLimiters {
  register: RequestHandler;
  login: RequestHandler;
  updateProfile: RequestHandler;
  passwordReset: RequestHandler;
  sendDeliveryOTP: RequestHandler;
  verifyDeliveryOTP: RequestHandler;
  sendEmailOTP: RequestHandler;
  verifyEmail: RequestHandler;
  refreshToken: RequestHandler;
  orderCreate: RequestHandler;
  orderVerify: RequestHandler;
  orderCOD: RequestHandler;
  cancelOrder: RequestHandler;
  aiAgentChat: RequestHandler;
  webhook: RequestHandler;
  /** Admin login — stricter to prevent brute force on high-value accounts */
  adminLogin: RequestHandler;
  /** Contact form submission — prevents spam */
  contact: RequestHandler;
  /** Review creation — prevents fake/spam reviews */
  createReview: RequestHandler;
  /** Verify OTP (password reset) — prevents brute-force guessing */
  verifyOtp: RequestHandler;
  /** Google OAuth endpoints — prevents auth flow abuse */
  googleAuth: RequestHandler;
  /** Cart actions (add/update/remove) — prevents rapid manipulation */
  cartActions: RequestHandler;
  /** Wishlist actions (add/remove) — prevents rapid manipulation */
  wishlistActions: RequestHandler;
  /** Order read operations (listing, detail) — for authenticated users */
  orderRead: RequestHandler;
  /** Public product listing endpoints — generous limit to prevent scraping */
  publicProducts: RequestHandler;
  /** Public reverse-geocode (checkout location autofill) — moderate limit */
  reverseGeocode: RequestHandler;
}

/**
 * Reusable default config shared across all rate limiters.
 * - standardHeaders: true → Returns `RateLimit-*` headers (RFC-compliant)
 * - legacyHeaders: false → Skips deprecated `X-RateLimit-*` headers
 */
const defaults = {
  standardHeaders: true,
  legacyHeaders: false,
} as const;

/**
 * Standard JSON error body for rate-limited responses.
 * Consistent with the rest of the API response convention (_status: false, _message).
 */
function jsonMessage(msg: string) {
  return { _status: false, _message: msg };
}

const rateLimiters: RateLimiters = {
  register: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: jsonMessage("Too many tries to Register, please try again later"),
  }),

  login: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: jsonMessage("Too many tries to Login, please try again later"),
  }),

  updateProfile: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: jsonMessage("Too many tries to Update Profile, please try again later"),
  }),

  passwordReset: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 25,
    message: jsonMessage("Too many tries to Reset Password, please try again later"),
  }),

  sendDeliveryOTP: rateLimit({
    ...defaults,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 15,
    message: jsonMessage("Too many tries to Send Delivery OTP, please try again later"),
  }),

  verifyDeliveryOTP: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: jsonMessage("Too many OTP verification attempts, please try again later"),
  }),

  sendEmailOTP: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: jsonMessage("Too many OTP requests, please try again later"),
  }),

  verifyEmail: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: jsonMessage("Too many verification attempts, please try again later"),
  }),

  refreshToken: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: jsonMessage("Too many refresh attempts, please try again later"),
  }),

  orderCreate: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: jsonMessage("Too many order creation attempts, please try again later"),
  }),

  orderVerify: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: jsonMessage("Too many payment verification attempts, please try again later"),
  }),

  orderCOD: rateLimit({
    ...defaults,
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: jsonMessage("Too many COD order attempts, please try again later"),
  }),

  cancelOrder: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: jsonMessage("Too many cancel attempts, please try again later"),
  }),

  aiAgentChat: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: jsonMessage("AI agent: too many requests, please try again later"),
  }),

  webhook: rateLimit({
    ...defaults,
    windowMs: 60 * 1000,
    max: 100,
    message: jsonMessage("Too many webhook requests, please try again later"),
  }),

  /**
   * Admin login — strict limit to prevent brute-force attacks.
   * 10 attempts per 15 minutes is reasonable for a single admin.
   */
  adminLogin: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: jsonMessage("Too many login attempts. Please try again later."),
  }),

  /** Contact form — low limit; real users rarely submit multiple forms */
  contact: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: jsonMessage("Too many contact submissions. Please try again later."),
  }),

  /** Review creation — limit to prevent spam/fake reviews */
  createReview: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: jsonMessage("Too many review submissions. Please try again later."),
  }),

  /**
   * Verify OTP (password reset flow) — strict to prevent brute-force.
   * 10 attempts per 15 minutes gives legitimate users room to type OTPs.
   */
  verifyOtp: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: jsonMessage("Too many verification attempts. Please try again later."),
  }),

  /** Google OAuth endpoints — prevents auth flow abuse */
  googleAuth: rateLimit({
    ...defaults,
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: jsonMessage("Too many auth requests. Please try again later."),
  }),

  /** Cart actions — prevents rapid add/remove spam */
  cartActions: rateLimit({
    ...defaults,
    windowMs: 60 * 1000,
    max: 20,
    message: jsonMessage("Too many cart actions. Please slow down."),
  }),

  /** Wishlist actions — prevents rapid add/remove spam */
  wishlistActions: rateLimit({
    ...defaults,
    windowMs: 60 * 1000,
    max: 20,
    message: jsonMessage("Too many wishlist actions. Please slow down."),
  }),

  /** Order read operations (listing, detail) — for authenticated users */
  orderRead: rateLimit({
    ...defaults,
    windowMs: 60 * 1000,
    max: 30,
    message: jsonMessage("Too many requests. Please slow down."),
  }),

  /**
   * Public product listing endpoints — generous limit to prevent scraping
   * while keeping normal browsing fast.
   */
  publicProducts: rateLimit({
    ...defaults,
    windowMs: 60 * 1000,
    max: 60,
    message: jsonMessage("Too many requests. Please slow down."),
  }),

  /**
   * Public reverse-geocode endpoint (checkout location autofill) —
   * called once per checkout session, so a moderate limit is generous.
   */
  reverseGeocode: rateLimit({
    ...defaults,
    windowMs: 60 * 1000,
    max: 10,
    message: jsonMessage("Too many location requests. Please try again in a minute."),
  }),
};

export default rateLimiters;