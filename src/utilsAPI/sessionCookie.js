import { hmacSha256Hex, timingSafeEqual, toHex, utf8 } from "../core/hmac";

// Server-side session backup for web. Safari (ITP) deletes script-writable
// storage (localStorage, IndexedDB) of a site not visited for 7 days. A cookie
// set by the server with HttpOnly survives that, so the app can restore the
// user from it. Read AGENTS.md ("Web sessions and Safari") before changing this.
//
// Cookie: v1.<user hex>.<expiry, unix seconds>.<HMAC-SHA256>, signed with
// SESSION_COOKIE_SECRET (server-only, never EXPO_PUBLIC_). It carries only the
// user id, never keys or tokens.

export const SESSION_COOKIE = "app_session";
const MAX_AGE_S = 400 * 24 * 60 * 60; // 400 days, the longest browsers accept
const MIN_SECRET_LENGTH = 32;

function secret() {
  const s = process.env.SESSION_COOKIE_SECRET;
  if (!s || s.length < MIN_SECRET_LENGTH) {
    throw new Error("SESSION_COOKIE_SECRET is missing or shorter than 32 characters");
  }
  return s;
}

const encode = (text) => toHex(utf8(text));
const decode = (hex) => {
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) throw new Error("bad hex");
  const bytes = new Uint8Array(hex.match(/../g).map((pair) => parseInt(pair, 16)));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
};
const mac = (payload) => hmacSha256Hex(secret(), payload);

// Always Secure in production. Safari refuses Secure cookies on http://localhost,
// so development drops the flag to keep the Safari flow testable locally.
const attributes = (maxAge) =>
  `Max-Age=${maxAge}; Path=/api; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

// Call only after the user has been authenticated by your own backend.
export function sessionSetCookie(user) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const payload = `v1.${encode(user)}.${exp}`;
  return `${SESSION_COOKIE}=${payload}.${mac(payload)}; ${attributes(MAX_AGE_S)}`;
}

export function sessionClearCookie() {
  return `${SESSION_COOKIE}=; ${attributes(0)}`;
}

// The user id in the request's session cookie, or null if absent, tampered, expired or unconfigured.
export function sessionUser(request) {
  const header = request.headers.get("cookie") || "";
  const value = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const payload = parts.slice(0, 3).join(".");
  try {
    if (!timingSafeEqual(mac(payload), parts[3])) return null;
    if (Number(parts[2]) * 1000 < Date.now()) return null;
    const user = decode(parts[1]);
    return user.length > 0 && user.length <= 200 ? user : null;
  } catch {
    return null;
  }
}
