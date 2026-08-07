/**
 * Cloudflare Turnstile verification helper.
 *
 * Verifies the frontend Turnstile widget token against Cloudflare's
 * siteverify endpoint. Must always be called on the server — never trust
 * the client's assertion that verification passed.
 *
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

import { env } from "../config/env.js";

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Verify a Turnstile token by calling the Cloudflare siteverify endpoint.
 *
 * @param token - The turnstile token received from the frontend widget.
 * @returns `true` if the token passes verification, `false` otherwise.
 */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  if (!token) return false;

  try {
    const formData = new URLSearchParams();
    formData.append("secret", env.TURNSTILE_SECRET_KEY!);
    formData.append("response", token);

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      },
    );

    if (!response.ok) return false;

    const data = (await response.json()) as TurnstileResponse;
    return data.success;
  } catch {
    return false;
  }
}
