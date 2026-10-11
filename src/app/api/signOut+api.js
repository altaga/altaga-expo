import { sessionClearCookie } from "../../utilsAPI/sessionCookie";
import { withSecurity } from "../../utilsAPI/withSecurity";

export const POST = withSecurity(async () => {
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", sessionClearCookie());
  return Response.json({ ok: true }, { headers });
});
