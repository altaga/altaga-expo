import { signRequestHeaders } from "./requestSigning";

// The only way the app calls its own /api routes: every request is signed.
// Web uses same-origin paths; native builds need EXPO_PUBLIC_API_URL.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function signedRequest(method, endpoint, body) {
  const rawBody = body === undefined ? "" : JSON.stringify(body);
  const headers = signRequestHeaders(rawBody);
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : rawBody,
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.error ?? `${method} ${endpoint} failed`);
  return data;
}

export const signedApiGet = (endpoint) => signedRequest("GET", endpoint);
export const signedApiPost = (endpoint, body = {}) => signedRequest("POST", endpoint, body);
