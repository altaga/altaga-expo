import { getCorsHeaders } from "./corsHelper";

// Wraps an /api handler. Authentication already ran in src/app/+middleware.js.
// This only adds CORS headers to the response and turns a thrown error into a
// generic 500 with no stack trace.
export function withSecurity(handler) {
  return async (request) => {
    const cors = getCorsHeaders(request);
    try {
      const response = await handler(request);
      const headers = new Headers(response.headers);
      for (const [name, value] of Object.entries(cors)) headers.set(name, value);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return Response.json({ error: "Internal Error" }, { status: 500, headers: cors });
    }
  };
}
