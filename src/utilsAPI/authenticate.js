// Replace with your real authentication (your backend, OAuth, passkeys, ...).
// Return the user id on success or null on failure. Never trust a user id sent
// by the client without verifying it here.
//
// The demo login accepts any name, so it only works outside production and when
// DEMO_AUTH_ENABLED=true. It can never be enabled in a production build.
export async function authenticate(credentials) {
  const demo = process.env.NODE_ENV !== "production" && process.env.DEMO_AUTH_ENABLED === "true";
  if (!demo) return null;
  const name = typeof credentials?.name === "string" ? credentials.name.trim() : "";
  return /^[A-Za-z0-9_-]{1,32}$/.test(name) ? `demo:${name}` : null;
}
