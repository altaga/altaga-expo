import { verifySignedRequest } from "../core/requestSigning";
import { getCorsHeaders, isAllowedOrigin } from "../utilsAPI/corsHelper";

// Single access gate for every /api/* route. A new route is protected by
// default. Do not gate routes one by one, and do not use Origin or User-Agent
// as authentication: both are client-controlled strings.
export const unstable_settings = {
  matcher: {
    patterns: [
      "/api",
      "/api/[...path]",
    ],
  },
};

// Routes called by third parties that cannot sign requests (for example a
// wallet fetching a payment request). Each must be harmless without
// authentication. Keep this list as short as possible.
const PUBLIC_ROUTES = new Set([]);

export default async function middleware(request) {
  if (PUBLIC_ROUTES.has(new URL(request.url).pathname)) return;

  const cors = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (!isAllowedOrigin(request)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers: cors });
  }

  // clone() leaves the original body unread for the route handler.
  const rawBody = request.method === "GET" ? "" : await request.clone().text();

  if (!verifySignedRequest(request, rawBody)) {
    return Response.json(
      { error: "Invalid or missing request signature" },
      { status: 401, headers: cors },
    );
  }
}
