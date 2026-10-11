# AGENTS.md

Guide for agents (and humans) working on this template or on a project created
from it. Read it before changing anything under `src/app/+middleware.js`,
`src/core/`, `src/providers/` or `src/utilsAPI/`.

## 1. What this is

An Expo Router app template, **web first**, with `"web": {"output": "server"}`:
the web build ships a client bundle and a server bundle (API routes and
middleware), so it needs a server-aware host (EAS Hosting, `npx expo serve`).
Plain static hosting will not work. Native builds compile from the same code,
but only the web path is tested.

What it gives a new project, already wired and tested:

- Public and private routes, guarded by the session.
- Sessions that survive reloads, app updates and Safari's storage eviction.
- App state in React Context, with a disposable versioned cache.
- Secure storage: IndexedDB on web, Keychain/Keystore on native.
- API routes behind one middleware gate: HMAC request signing plus an Origin check.
- Per-user authorization in API routes from an HttpOnly session cookie.
- No runtime dependencies beyond Expo/React Native. HMAC-SHA256 is in
  `src/core/hmac.js`; do not add `ethers`, `crypto-js` or similar for it.

## 2. Starting a new project from the template

1. Rename `name` in `package.json` and `name`, `slug`, `scheme` in `app.json`.
2. `cp .env.example .env` and fill it. Generate each secret with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   `API_SIGNING_SECRET` and `EXPO_PUBLIC_API_SIGNING_SECRET` must be identical.
   `SESSION_COOKIE_SECRET` must be different from both.
3. Set `ALLOWED_ORIGINS` to the production origin(s), comma-separated.
4. Replace `src/utilsAPI/authenticate.js` with real authentication (your backend,
   OAuth, passkeys). It must return a user id only after verifying credentials.
5. Delete the demo pieces you don't need: the counter and API buttons in
   `src/app/(private)/index.js`, `src/app/api/hello+api.js`.
6. Register the same variables in EAS for each environment (see §9).
7. Run the checks in §8.

## 3. Layout

```
src/
  app/
    _layout.js              providers + guarded navigator (Stack.Protected)
    +middleware.js          the only access gate for /api/*
    +not-found.js           unknown URL -> entry point of the available side
    +html.js                web document shell
    (public)/               signed-out screens (sign-in, sign-up, ...)
    (private)/              signed-in screens (index.js is "/")
    api/
      session+api.js        GET: user from the session cookie, refreshes it
      signIn+api.js         POST: authenticate() then set the session cookie
      signOut+api.js        POST: clear the session cookie
      me+api.js             example private API route (authorizes by cookie)
      hello+api.js          example signed route
  components/splashView.js  shown while the session loads
  core/
    hmac.js                 SHA-256 / HMAC-SHA256, no dependencies
    requestSigning.js       sign (client) and verify (middleware) requests
    api.js                  signedApiGet / signedApiPost: the only way to call /api
    cache.js                versioned, disposable app cache
    styles.js               design tokens and createGlobalStyles
    polyfills.js, error.js  imported first by _layout.js
  providers/
    sessionProvider.js      useSession(): status, user, signIn, signOut
    contextModule.js        app state: setValue, setPersistentValue, resetValue
    contextLoader.js        restores the cache into app state at start
    smartProvider.js        phone frame on desktop web + useSmartSize()
  utilsAPI/                 server-only helpers (never import from screens)
    authenticate.js         replace with real authentication
    sessionCookie.js        signed HttpOnly session cookie
    corsHelper.js           ALLOWED_ORIGINS + CORS headers
    withSecurity.js         CORS headers + generic 500 for route handlers
  utilsApp/utils.js         AsyncStorage helpers + secure storage
tests/security.test.mjs     node --test suite (npm test)
```

## 4. State: four layers, never mixed

| Layer | Where | Survives | Use for |
|---|---|---|---|
| Session | `sessionProvider.js` → secure record `Session` + HttpOnly cookie | reloads, updates, cache resets, Safari eviction (via cookie) | who is signed in |
| Secure storage | `get/setEncryptedStorageValue` (IndexedDB on web, SecureStore on native) | reloads, updates | credentials, tokens, PINs |
| App state | `ContextModule` (`setValue`) | nothing (memory) | UI and session-scoped data |
| Cache | `setPersistentValue` → `core/cache.js` (AsyncStorage = localStorage on web) | reloads, until `CACHE_VERSION` changes | data that can be fetched again |

Rules:

- **An update must never sign anyone out.** When the cached shape changes, bump
  `CACHE_VERSION` in `core/cache.js`: only the cache resets. Never clear secure
  storage or the session as part of a migration.
- **Never put the session, tokens or keys in the cache** or in AsyncStorage.
  The cache can disappear at any moment.
- `setEncryptedStorageValue` **throws** when it cannot store. Do not catch it and
  carry on as if the value were stored, and never add a plaintext fallback.
- Secure storage on web: IndexedDB is the source of truth. A `localStorage`
  copy is written only when IndexedDB is blocked, and removed once IndexedDB
  works again.
- Sign-out clears the server cookie first, then secure storage, then app state
  and cache (`resetValue`). If the server call fails the user stays signed in:
  otherwise the cookie would silently sign them back in on the next start.
- When you change storage keys or the boot flow, test with storage written by
  the previous version (seed IndexedDB/localStorage as the old code left it).

## 5. Routes

- `src/app/_layout.js` renders `(private)` only while `status === "signedIn"`
  and `(public)` only while signed out (`Stack.Protected`). While the session
  loads it renders `SplashView`, so private screens never flash.
- New private screen: add a file under `(private)/`. New public screen: under
  `(public)/`. A screen that must be reachable in both states goes at the root
  of `src/app/` with its own `<Stack.Screen>` outside the `Stack.Protected` blocks.
- Never `<Redirect>` or `router.replace()` to a route whose group may be
  unavailable: the navigator does not handle it (the page stays blank). Pick the
  target from `useSession().status`, as `+not-found.js` does.
- Route guards are UX, not security. Anything private must also be enforced in
  the API route (§6).

## 6. API security

- `src/app/+middleware.js` runs before every `/api/*` route. A new route is
  protected by default; nothing to opt into. Do not move checks into routes.
- The gate, in order: `OPTIONS` → 204; Origin not allowed → 403; signature
  missing, wrong or older than 5 minutes → 401. The body is verified from
  `request.clone()`, so handlers still read `request.json()` normally.
- **Never use Origin or User-Agent as authentication.** Both are strings any
  client can set. Origin only stops other websites' scripts in a real browser.
- Call your own API only through `signedApiGet` / `signedApiPost` (`core/api.js`).
  On web the requests are same-origin; native builds need `EXPO_PUBLIC_API_URL`.
- **The signature proves the call came from the app, not who the user is.**
  The signing secret ships in the web bundle by design, so a determined attacker
  can extract it. For anything user-specific, read the user with
  `sessionUser(request)` (see `me+api.js`) and never trust a user id from the
  request body.
- `PUBLIC_ROUTES` in the middleware skips the gate. Only for third parties that
  cannot sign (for example a wallet fetching a payment request), only for routes
  that are harmless without authentication. Keep it empty if you can.
- Wrap handlers with `withSecurity`: it adds CORS headers, keeps the handler's
  status and headers (including several `Set-Cookie`), and turns a throw into a
  generic 500 without details.
- Secrets: anything prefixed `EXPO_PUBLIC_` is inlined into the client bundle.
  Only `EXPO_PUBLIC_API_SIGNING_SECRET` and `EXPO_PUBLIC_API_URL` may be public.
  Server secrets (`SESSION_COOKIE_SECRET`, backend API keys) never get the prefix
  and are read only in `src/utilsAPI/` and `src/app/api/`.
- `DEMO_AUTH_ENABLED` is ignored in production builds (`NODE_ENV=production`),
  and localhost origins are accepted only outside production.

## 7. Web sessions and Safari

Safari (ITP) deletes all script-writable storage (localStorage, IndexedDB) of a
site the user has not opened for 7 days. Cookies set by the server with
`HttpOnly` are kept. So:

- `signIn+api.js` sets `app_session`: `v1.<user hex>.<expiry>.<HMAC>`, signed
  with `SESSION_COOKIE_SECRET`, `HttpOnly; SameSite=Lax; Path=/api`, `Secure` in
  production, valid 400 days. It carries only the user id.
- At start, `sessionProvider.js` reads the secure record. If it is empty on web it
  calls `/api/session`, which returns the cookie's user and re-issues the cookie,
  and writes the user back to IndexedDB.
- A tampered, expired or foreign-secret cookie restores nobody.
- Development omits `Secure` because Safari rejects Secure cookies on
  `http://localhost`. Production always sets it.

## 8. Verify

Nothing here is verified until these pass:

1. `npm test`: HMAC against RFC 4231 vectors and `node:crypto`, signing,
   middleware, `withSecurity`, session cookie, demo-auth gating.
2. `npm run webbuild`: the production web build (`expo export -p web`).
3. In a real browser (headless Playwright is fine), **Chromium and WebKit**:
   signed out `/` → sign-in; sign in → private home; reload keeps the session;
   wipe localStorage + IndexedDB but keep cookies → the session comes back;
   sign out → reload stays signed out; unsigned `fetch('/api/hello')` → 401.
4. Server checks against `npx expo serve` of the production build (not the dev
   server): foreign Origin → 403, unsigned → 401, demo sign-in → 401.

Known quirks:

- The Expo dev server rejects foreign Origins itself (HTTP 500) before the
  middleware runs. Test Origin handling against `expo serve`.
- `expo serve` answers `OPTIONS` preflights itself. The real request still goes
  through the middleware.
- If an edit does not show up in the dev server (old code in the bundle),
  restart it with `npx expo start --web --clear`.
- `npm run lint` needs `eslint` and `eslint-config-expo`, which are not installed.

## 9. Deploy (EAS Hosting)

- Register every variable per environment. Use `--visibility sensitive` for
  values `eas deploy` must read (`secret` variables are not readable by it).
- `eas deploy` bakes the environment variables into that deployment. A
  deployment keeps working after variables change or disappear, which hides
  mistakes until the next deploy. Check `eas env:list --environment production`
  first when every `/api` call fails after a deploy.
- Flow: `npm run webbuild` → `eas deploy` (preview) → test the preview URL
  (§8.3) → promote with `eas deploy --prod` or alias the tested deployment.
  Add the preview origin to `ALLOWED_ORIGINS` for that environment, or the
  preview's API calls get 403.
- After promoting, check production in a browser. Roll back to the last good
  deployment first, investigate second.

## 10. Template maintenance

- `.github/workflows/auto-publish.yml` runs every Sunday: it updates
  dependencies with `scripts/update-packages.js` (7-day minimum release age, Expo
  SDK pins), bumps the patch version, pushes to `main` and publishes to npm.
  Whatever is on `main` is published.
- `.npmignore` replaces `.gitignore` for npm. Every secret rule must be in both.
  Check with `npm pack --dry-run` before publishing by hand.
