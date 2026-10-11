import { sessionSetCookie, sessionUser } from "../../utilsAPI/sessionCookie";
import { withSecurity } from "../../utilsAPI/withSecurity";

// Returns the user from the HttpOnly session cookie and re-issues the cookie
// with a fresh expiry. The app calls it at start when its own storage is empty.
export const GET = withSecurity(async (request) => {
  const user = sessionUser(request);
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (user) {
    try {
      headers.append("Set-Cookie", sessionSetCookie(user));
    } catch {
      // Not configured: answer without refreshing the cookie.
    }
  }
  return Response.json({ user }, { headers });
});
