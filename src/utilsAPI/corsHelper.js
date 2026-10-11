// Origins come from ALLOWED_ORIGINS (comma-separated, server env). Localhost is
// accepted only outside production. Origin is a client-controlled string, so this
// is defense-in-depth against cross-site browser calls, not authentication: the
// request signature in src/core/requestSigning.js is the real gate.

const LOCALHOST_ORIGIN = /^http:\/\/localhost:\d+$/;

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isKnownOrigin(origin) {
  if (allowedOrigins().includes(origin)) return true;
  return process.env.NODE_ENV !== "production" && LOCALHOST_ORIGIN.test(origin);
}

// Requests without an Origin header pass: native apps and server-side callers never send one.
export function isAllowedOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return isKnownOrigin(origin);
}

export function getCorsHeaders(request) {
  const origin = request.headers.get("origin");
  const allowedOrigin = origin && isKnownOrigin(origin) ? origin : allowedOrigins()[0] ?? "null";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Timestamp, X-Signature",
  };
}
