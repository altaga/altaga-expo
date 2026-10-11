import { sessionUser } from "../../utilsAPI/sessionCookie";
import { withSecurity } from "../../utilsAPI/withSecurity";

// Private API route. The request signature only proves the call came from the
// app; who the user is comes from the HttpOnly session cookie. Never trust a user
// id sent in the request body for authorization.
export const GET = withSecurity(async (request) => {
  const user = sessionUser(request);
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
});
