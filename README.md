# Altaga Expo Template

An ultra-minimalist, high-end Expo starting block for the web (Expo Router with server output). Web only: no iOS or Android configuration.

It ships the infrastructure most templates leave out, already wired and tested: public and private routes, sessions that survive Safari's storage eviction, secure storage, layered state management, and API routes behind a signed-request gate. All with no runtime dependencies beyond Expo and React Native, and a highly opinionated "Luxury Dark" aesthetic.

**Agents and contributors: read [AGENTS.md](./AGENTS.md) first.** It holds the rules this README only summarizes.

---

## 🌟 Philosophy: The "Aesthetic Provocateur"
Most modern apps suffer from the "AI Look"—soft glows, rounded generic cards, and diffused drop shadows. This template purposefully rejects that. 
- **Brutal & Editorial**: Zero drop shadows. Sharp interfaces relying on pure whitespace and aggressive layout grids.
- **Typographic Hierarchy**: Massive, high-contrast display titles paired with tiny, wide-tracked monospace metadata.
- **Deep Palette**: Built on a foundation of Rich Black (`#0A0A0A`) with reserved, high-impact Metallic Gold (`#D4AF37`) accents.

---

## 🚀 Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create your `.env`** (git-ignored) from the template and fill in the secrets. The file explains how to generate them:
   ```bash
   cp .env.example .env
   ```
   For a local demo, set `DEMO_AUTH_ENABLED=true`. The sign-in screen then accepts any name. Production builds ignore that flag.
3. **Start the web dev server**
   ```bash
   npm run web
   ```
4. **Check everything**
   ```bash
   npm test          # security suite
   npm run webbuild  # production web build
   ```

---

## 📂 Project Architecture

```text
src/
├── app/
│   ├── _layout.js         # Providers + guarded navigator (public vs private)
│   ├── +middleware.js     # The single access gate for every /api route
│   ├── (public)/          # Signed-out screens (sign-in.js)
│   ├── (private)/         # Signed-in screens (index.js is "/")
│   └── api/               # session, signIn, signOut, me (private), hello
├── components/            # splashView.js
├── core/
│   ├── api.js             # signedApiGet / signedApiPost
│   ├── cache.js           # Versioned, disposable app cache
│   ├── hmac.js            # Dependency-free SHA-256 / HMAC-SHA256
│   ├── requestSigning.js  # Request signatures (client signs, middleware verifies)
│   └── styles.js          # Reactive GlobalStyles and design tokens
├── hocs/useHOCS.js        # Hooks for legacy class components
├── providers/
│   ├── sessionProvider.js # useSession(): status, user, signIn, signOut
│   ├── contextModule.js   # App state (React Context)
│   ├── contextLoader.js   # Restores the cache at start
│   └── smartProvider.js   # Responsive math + desktop phone frame
├── utilsAPI/              # Server-only: auth, session cookie, CORS, withSecurity
└── utilsApp/utils.js      # Secure storage (IndexedDB) + helpers
```

---

## 🛠 Usage & Implementation Guide

### 1. The Global Styling Engine (`smartSize`)
Unlike generic templates that use static pixel counts, this template uses a mathematical multiplier to ensure your app looks identical on a 4K Web screen, an iPad, and an iPhone Mini.

**How to use it in a new screen:**
Whenever you build a new screen, always wrap your styles in the `smartSize` context.

```javascript
import { View, Text } from "react-native";
import { createGlobalStyles } from "../../core/styles";
import { useSmartSize } from "../../providers/smartProvider";

export default function DashboardScreen() {
  // 1. Hook into the layout math
  const smartSize = useSmartSize();
  const { normalize } = smartSize; 
  
  // 2. Hydrate the global styles with current screen dimensions
  const GlobalStyles = createGlobalStyles(smartSize);

  return (
    <View style={GlobalStyles.container}>
      <View style={GlobalStyles.header}>
        {/* Uses the pre-defined Luxury Dark header typography */}
        <Text style={GlobalStyles.heroTitle}>Dashboard</Text> 
      </View>
      
      {/* Use normalize() for custom, on-the-fly padding that scales */}
      <View style={{ padding: normalize(20) }}>
        <Text style={GlobalStyles.bodyText}>System Operational.</Text>
      </View>
    </View>
  );
}
```

### 2. Changing the Aesthetic (Theming)
All design tokens live in `src/core/styles.js`. 
To re-theme the template away from "Luxury Dark", simply change the hex codes at the top of the file:
```javascript
export const backgroundColor = "#080808"; // Change to #F9F9F6 for a white mode
export const cardColor = "#1C1C1E";       // Elevated surface
export const accentColor = "#D4AF37";     // Change to your brand color
```

### 3. Public and Private Routes
Put signed-out screens in `src/app/(public)/` and signed-in screens in `src/app/(private)/`. The root layout shows only the side that matches the session, and a splash while it loads.

```javascript
import { useSession } from "../../providers/sessionProvider";

export default function Profile() {
  const { user, signOut } = useSession();
  // ...
}
```

### 4. Sessions That Survive Safari
`useSession().signIn(credentials)` calls `/api/signIn`. The session is stored in IndexedDB, and the server also sets a signed `HttpOnly` cookie. Safari deletes a site's storage after 7 days without a visit, but not that cookie, so the app restores the session from it at start. Updates never sign anyone out: the session lives apart from the cache.

Replace `src/utilsAPI/authenticate.js` with your real authentication before shipping.

### 5. State Management
| Need | Use |
|---|---|
| Who is signed in | `useSession()` |
| Secrets, tokens | `setEncryptedStorageValue` / `getEncryptedStorageValue` |
| In-memory app state | `const { value, setValue } = useContext(ContextModule)` |
| State restored on next start | `setPersistentValue({ ... })` (versioned cache, may be discarded) |

```javascript
import { useContext } from "react";
import ContextModule from "../../providers/contextModule";

export default function Settings() {
  const { value, setPersistentValue } = useContext(ContextModule);
  return /* ... */ setPersistentValue({ theme: "dark" });
}
```

`setEncryptedStorageValue` throws if it cannot store the value. It never falls back to plaintext storage.

### 6. Writing Secure API Routes
Every `/api/*` route is protected by `src/app/+middleware.js`: requests need a valid HMAC signature and an allowed Origin. Call your routes with `signedApiGet` / `signedApiPost` from `src/core/api.js`. For user-specific data, read the user from the session cookie:

```javascript
// src/app/api/orders+api.js
import { sessionUser } from "../../utilsAPI/sessionCookie";
import { withSecurity } from "../../utilsAPI/withSecurity";

export const GET = withSecurity(async (request) => {
  const user = sessionUser(request);
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json({ orders: [] });
});
```

The signing secret is in the web bundle by design: the signature stops scripts and scanners, not a determined attacker. That is why authorization must come from the session cookie.

### 7. Legacy Support (HOCs)
For teams migrating older React Class Components, the `useHOCS` middleware is provided. Wrap any old class component in `useHOCS` to instantly give it access to Expo Router's `useNavigation` and `useGlobalSearchParams` hooks.

---

## ⚖️ Final Notes
- **React Compiler Enabled:** This project opts into React 19's Compiler in `app.json` for massive performance gains. Write your logic naturally; you generally do not need `useMemo` or `useCallback`.
- **Typing:** Typed Routes are enabled by default, ensuring navigation integrity across large routing stacks.
- **Secrets:** only `.env.example` is committed or published. `.env` is ignored by both git and npm.
