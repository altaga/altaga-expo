import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { beforeEach, describe, test } from "node:test";

const SECRET = "test-signing-secret-0123456789abcdef";
const COOKIE_SECRET = "test-cookie-secret-0123456789abcdef";

beforeEach(() => {
  process.env.API_SIGNING_SECRET = SECRET;
  process.env.EXPO_PUBLIC_API_SIGNING_SECRET = SECRET;
  process.env.SESSION_COOKIE_SECRET = COOKIE_SECRET;
  process.env.ALLOWED_ORIGINS = "https://app.example.com";
  process.env.NODE_ENV = "production";
  delete process.env.DEMO_AUTH_ENABLED;
});

const { sha256, hmacSha256Hex, toHex, utf8 } = await import("../src/core/hmac.js");
const { signRequestHeaders, verifySignedRequest } = await import("../src/core/requestSigning.js");
const { default: middleware } = await import("../src/app/+middleware.js");
const { withSecurity } = await import("../src/utilsAPI/withSecurity.js");
const { sessionSetCookie, sessionUser, sessionClearCookie, SESSION_COOKIE } = await import("../src/utilsAPI/sessionCookie.js");
const { authenticate } = await import("../src/utilsAPI/authenticate.js");
const { isAllowedOrigin } = await import("../src/utilsAPI/corsHelper.js");

const randomText = (n) => {
  const pool = "abcXYZ019 .,:;{}\"'\\/ñé€😀\n\t";
  return Array.from({ length: n }, () => [...pool][Math.floor(Math.random() * [...pool].length)]).join("");
};

const signedRequest = (method, body, extraHeaders = {}) => {
  const raw = body === undefined ? "" : JSON.stringify(body);
  return new Request("https://app.example.com/api/hello", {
    method,
    headers: { ...signRequestHeaders(raw), "Content-Type": "application/json", ...extraHeaders },
    body: body === undefined ? undefined : raw,
  });
};

describe("hmac", () => {
  test("SHA-256 known vectors", () => {
    assert.equal(toHex(sha256(utf8(""))), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    assert.equal(toHex(sha256(utf8("abc"))), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  test("HMAC-SHA256 RFC 4231 test case 2", () => {
    assert.equal(
      hmacSha256Hex("Jefe", "what do ya want for nothing?"),
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });

  test("matches node:crypto for random keys and messages, including block boundaries", () => {
    for (const len of [0, 1, 55, 56, 63, 64, 65, 119, 120, 127, 128, 1000]) {
      const bytes = randomBytes(len);
      assert.equal(toHex(sha256(bytes)), createHash("sha256").update(bytes).digest("hex"), `sha256 len ${len}`);
    }
    for (let i = 0; i < 300; i++) {
      const key = randomText(Math.floor(Math.random() * 150));
      const message = randomText(Math.floor(Math.random() * 400));
      assert.equal(hmacSha256Hex(key, message), createHmac("sha256", key).update(message).digest("hex"));
    }
  });
});

describe("request signing", () => {
  test("a signed body verifies", () => {
    const raw = JSON.stringify({ amount: 1 });
    const request = new Request("https://x/api", { method: "POST", headers: signRequestHeaders(raw) });
    assert.equal(verifySignedRequest(request, raw), true);
  });

  test("a changed body, missing headers or an old timestamp fail", () => {
    const raw = JSON.stringify({ amount: 1 });
    const headers = signRequestHeaders(raw);
    assert.equal(verifySignedRequest(new Request("https://x", { headers }), JSON.stringify({ amount: 2 })), false);
    assert.equal(verifySignedRequest(new Request("https://x"), raw), false);
    const old = String(Date.now() - 6 * 60 * 1000);
    const stale = new Request("https://x", { headers: { "X-Timestamp": old, "X-Signature": hmacSha256Hex(SECRET, `${old}.${raw}`) } });
    assert.equal(verifySignedRequest(stale, raw), false);
  });

  test("a client clock slightly ahead is accepted", () => {
    const ahead = String(Date.now() + 60 * 1000);
    const request = new Request("https://x", { headers: { "X-Timestamp": ahead, "X-Signature": hmacSha256Hex(SECRET, `${ahead}.`) } });
    assert.equal(verifySignedRequest(request, ""), true);
  });

  test("a short or missing secret refuses to sign and never verifies", () => {
    process.env.API_SIGNING_SECRET = "short";
    process.env.EXPO_PUBLIC_API_SIGNING_SECRET = "short";
    assert.throws(() => signRequestHeaders(""));
    const ts = String(Date.now());
    assert.equal(verifySignedRequest(new Request("https://x", { headers: { "X-Timestamp": ts, "X-Signature": hmacSha256Hex("short", `${ts}.`) } }), ""), false);
  });
});

describe("middleware", () => {
  test("OPTIONS preflight gets 204", async () => {
    const response = await middleware(new Request("https://app.example.com/api/hello", { method: "OPTIONS" }));
    assert.equal(response.status, 204);
  });

  test("a foreign browser origin gets 403", async () => {
    const response = await middleware(signedRequest("POST", { a: 1 }, { Origin: "https://evil.example" }));
    assert.equal(response.status, 403);
  });

  test("localhost is refused in production and accepted in development", async () => {
    const request = new Request("https://x", { headers: { Origin: "http://localhost:8081" } });
    assert.equal(isAllowedOrigin(request), false);
    process.env.NODE_ENV = "development";
    assert.equal(isAllowedOrigin(request), true);
  });

  test("an unsigned request gets 401, whatever its User-Agent", async () => {
    const request = new Request("https://app.example.com/api/hello", {
      method: "POST",
      headers: { "User-Agent": "Mozilla/5.0", Origin: "https://app.example.com" },
      body: "{}",
    });
    assert.equal((await middleware(request)).status, 401);
  });

  test("a signed POST passes and the route can still read the body", async () => {
    const request = signedRequest("POST", { hello: "ñ😀" });
    assert.equal(await middleware(request), undefined);
    assert.deepEqual(await request.json(), { hello: "ñ😀" });
  });

  test("a signed GET passes", async () => {
    assert.equal(await middleware(signedRequest("GET")), undefined);
  });
});

describe("withSecurity", () => {
  test("keeps the handler's status and every Set-Cookie header, and adds CORS", async () => {
    const handler = withSecurity(async () => {
      const headers = new Headers();
      headers.append("Set-Cookie", "a=1; Path=/");
      headers.append("Set-Cookie", "b=2; Path=/");
      return Response.json({ error: "no" }, { status: 401, headers });
    });
    const response = await handler(new Request("https://x", { headers: { Origin: "https://app.example.com" } }));
    assert.equal(response.status, 401);
    assert.deepEqual(response.headers.getSetCookie(), ["a=1; Path=/", "b=2; Path=/"]);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://app.example.com");
  });

  test("a thrown error becomes a generic 500", async () => {
    const response = await withSecurity(async () => {
      throw new Error("secret detail");
    })(new Request("https://x"));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Internal Error" });
  });
});

describe("session cookie", () => {
  const withCookie = (setCookie) => new Request("https://x", { headers: { Cookie: setCookie.split(";")[0] } });

  test("round trip, including non-ASCII ids", () => {
    const cookie = sessionSetCookie("user-ñ-😀");
    assert.match(cookie, /HttpOnly; SameSite=Lax; Secure$/);
    process.env.NODE_ENV = "development";
    assert.doesNotMatch(sessionSetCookie("x"), /Secure/);
    process.env.NODE_ENV = "production";
    assert.equal(sessionUser(withCookie(cookie)), "user-ñ-😀");
  });

  test("a tampered, foreign or expired cookie restores nobody", () => {
    const cookie = sessionSetCookie("alice").split(";")[0];
    const [name, value] = cookie.split("=");
    const parts = value.split(".");
    const forged = [parts[0], toHex(utf8("mallory")), parts[2], parts[3]].join(".");
    assert.equal(sessionUser(new Request("https://x", { headers: { Cookie: `${name}=${forged}` } })), null);

    process.env.SESSION_COOKIE_SECRET = "another-cookie-secret-0123456789abcdef";
    assert.equal(sessionUser(new Request("https://x", { headers: { Cookie: cookie } })), null);
    process.env.SESSION_COOKIE_SECRET = COOKIE_SECRET;

    const exp = Math.floor(Date.now() / 1000) - 1;
    const payload = `v1.${toHex(utf8("alice"))}.${exp}`;
    const expired = `${SESSION_COOKIE}=${payload}.${hmacSha256Hex(COOKIE_SECRET, payload)}`;
    assert.equal(sessionUser(new Request("https://x", { headers: { Cookie: expired } })), null);
  });

  test("no secret configured means no session, not a crash", () => {
    const cookie = sessionSetCookie("alice");
    delete process.env.SESSION_COOKIE_SECRET;
    assert.equal(sessionUser(withCookie(cookie)), null);
  });

  test("a private API route answers only with a valid session", async () => {
    const { GET } = await import("../src/app/api/me+api.js");
    assert.equal((await GET(new Request("https://x/api/me"))).status, 401);
    const signedIn = await GET(withCookie(sessionSetCookie("alice")));
    assert.equal(signedIn.status, 200);
    assert.deepEqual(await signedIn.json(), { user: "alice" });
  });

  test("sign-out cookie expires immediately", () => {
    assert.match(sessionClearCookie(), /Max-Age=0/);
  });
});

describe("demo authentication", () => {
  test("is impossible in production, even with the flag", async () => {
    process.env.DEMO_AUTH_ENABLED = "true";
    assert.equal(await authenticate({ name: "alice" }), null);
  });

  test("works only in development with the flag, and validates the name", async () => {
    process.env.NODE_ENV = "development";
    assert.equal(await authenticate({ name: "alice" }), null);
    process.env.DEMO_AUTH_ENABLED = "true";
    assert.equal(await authenticate({ name: "alice" }), "demo:alice");
    assert.equal(await authenticate({ name: "<script>" }), null);
    assert.equal(await authenticate(null), null);
  });
});
