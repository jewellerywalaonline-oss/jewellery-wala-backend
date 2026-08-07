import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import cache from "../../lib/cache.js";
import { success, fail } from "../../utils/responses.js";

/**
 * Reverse geocodes a lat/lng coordinate via LocationIQ and maps the result
 * to the checkout shipping-address form fields (India only).
 *
 * The LocationIQ API key stays server-side — the browser only sends { lat, lng }.
 *
 * Endpoint: POST /api/website/location/reverse-geocode
 * Body:     { lat: number, lng: number }
 * Response: { _status: true, _data: { pincode, city, state, area, street, country, displayName } }
 */

const LOCATIONIQ_BASE_URL = "https://us1.locationiq.com/v1/reverse";
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour
const FETCH_TIMEOUT_MS = 4000;

interface LocationIQAddress {
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

interface LocationIQResponse {
  display_name?: string;
  address?: LocationIQAddress;
}

interface MappedAddress {
  pincode: string;
  city: string;
  state: string;
  area: string;
  street: string;
  country: string;
  displayName: string;
}

/**
 * Indian states + union territories, matching the frontend list
 * (web/src/lib/utils.ts → INDIAN_STATES). The checkout state <Select>
 * only accepts these values, so the mapped state must land on one of them.
 */
const INDIAN_STATES = new Set([
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
]);

/**
 * Normalize a LocationIQ state string to one of the canonical Indian states.
 * Falls back to "" (UI leaves the field blank) if it can't be matched.
 */
function normalizeState(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();

  // 1. Exact match
  if (INDIAN_STATES.has(trimmed)) return trimmed;

  // 2. Strip common suffixes (" State", " Union Territory", " UT", " Region")
  const withoutSuffix = trimmed
    .replace(/\s+(state|union territory|ut|region|province)$/i, "")
    .trim();
  if (INDIAN_STATES.has(withoutSuffix)) return withoutSuffix;

  // 3. "NCT of Delhi" / "National Capital Territory of Delhi" → "Delhi"
  const delhiMatch = trimmed.match(/delhi/i);
  if (delhiMatch) return "Delhi";

  return "";
}

export const reverseGeocode = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    if (!env.LOCATIONIQ_API_KEY) {
      return fail(res, "Location service is not configured", 503);
    }

    const { lat, lng } = req.body as { lat?: unknown; lng?: unknown };
    // Validate the RAW input type first — Number(null) → 0, Number("") → 0,
    // Number(true) → 1, Number([]) → 0 all silently coerce and would pass a
    // range check, so reject non-finite-number inputs before coercion.
    const latNum = typeof lat === "number" ? lat : NaN;
    const lngNum = typeof lng === "number" ? lng : NaN;

    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      return fail(res, "Valid latitude (between -90 and 90) is required", 400);
    }
    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      return fail(res, "Valid longitude (between -180 and 180) is required", 400);
    }

    // Round to 4 decimals so nearby requests share a cache entry
    const cacheKey = `geocode:${latNum.toFixed(4)},${lngNum.toFixed(4)}`;
    const cached = cache.get<MappedAddress>(cacheKey);
    if (cached) {
      return success(res, cached);
    }

    const url = new URL(LOCATIONIQ_BASE_URL);
    url.searchParams.set("key", env.LOCATIONIQ_API_KEY);
    url.searchParams.set("lat", String(latNum));
    url.searchParams.set("lon", String(lngNum));
    url.searchParams.set("format", "json");
    url.searchParams.set("accept-language", "en");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let data: LocationIQResponse;
    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        logger.error(
          { status: response.status },
          "LocationIQ reverse-geocode request failed",
        );
        return fail(res, "Location lookup failed", 502);
      }
      data = (await response.json()) as LocationIQResponse;
    } finally {
      clearTimeout(timeout);
    }

    const address = data.address ?? {};

    // India-only: the checkout state <Select> is restricted to Indian states.
    const country = (address.country ?? "").toLowerCase();
    const countryCode = (address.country_code ?? "").toLowerCase();
    const isIndia =
      country === "india" ||
      country.includes("india") ||
      countryCode === "in";

    if (!isIndia) {
      return res.status(422).json({
        _status: false,
        _message: "Location outside India",
      });
    }

    const pincode = (address.postcode ?? "").replace(/\D/g, "").slice(0, 6);
    if (!pincode) {
      return res.status(422).json({
        _status: false,
        _message: "Location has no postal code",
      });
    }

    const mapped: MappedAddress = {
      pincode,
      city: (address.city || address.town || address.village || "").trim(),
      state: normalizeState(address.state),
      area: (address.suburb || address.neighbourhood || "").trim(),
      street: (address.road ?? "").trim(),
      country: "India",
      displayName: data.display_name ?? "",
    };

    cache.set(cacheKey, mapped, CACHE_TTL_SECONDS);

    return success(res, mapped);
  } catch (error) {
    logger.error({ err: error }, "Reverse geocode error");
    return fail(
      res,
      "Location lookup failed",
      500,
      error instanceof Error ? error.message : error,
    );
  }
};
