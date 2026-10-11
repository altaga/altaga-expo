import { withSecurity } from "../../utilsAPI/withSecurity";

// Signed by default: the middleware rejects requests without a valid signature.
export const GET = withSecurity(async () => Response.json({ hello: "world" }));

export const POST = withSecurity(async () => Response.json({ hello: "world" }));
