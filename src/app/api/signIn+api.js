import { authenticate } from "../../utilsAPI/authenticate";
import { sessionSetCookie } from "../../utilsAPI/sessionCookie";
import { withSecurity } from "../../utilsAPI/withSecurity";

export const POST = withSecurity(async (request) => {
  const credentials = await request.json().catch(() => null);
  const user = await authenticate(credentials);
  if (!user) return Response.json({ error: "Invalid credentials" }, { status: 401 });

  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", sessionSetCookie(user));
  return Response.json({ user }, { headers });
});
