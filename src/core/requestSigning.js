import { hmacSha256Hex, timingSafeEqual } from "./hmac";

// HMAC-SHA256 request signing for every /api/* route. The middleware
// (src/app/+middleware.js) verifies it; src/core/api.js signs with it.
// Read AGENTS.md ("Request authentication") before changing this file.
//
// The secret is readable from the client bundle by design (the app must sign
// with it). This stops casual and automated abuse, not a determined attacker.

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;

function getSigningSecret() {
  const secret =
    process.env.EXPO_PUBLIC_API_SIGNING_SECRET || process.env.API_SIGNING_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("API signing secret is missing or shorter than 32 characters");
  }
  return secret;
}

const sign = (timestamp, rawBody, secret) => hmacSha256Hex(secret, `${timestamp}.${rawBody}`);

export function signRequestHeaders(rawBody) {
  const timestamp = Date.now().toString();
  return {
    "X-Timestamp": timestamp,
    "X-Signature": sign(timestamp, rawBody, getSigningSecret()),
  };
}

// rawBody must be the exact bytes sent: the signature covers the body untouched.
export function verifySignedRequest(request, rawBody) {
  const timestamp = request.headers.get("x-timestamp");
  const signature = request.headers.get("x-signature");
  if (!timestamp || !signature) return false;

  // The client clock can run ahead of the server's, so the skew is checked both ways.
  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > MAX_CLOCK_SKEW_MS) return false;

  let expected;
  try {
    expected = sign(timestamp, rawBody ?? "", getSigningSecret());
  } catch {
    return false;
  }
  return timingSafeEqual(expected, signature);
}
