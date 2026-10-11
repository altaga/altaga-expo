import { Redirect } from "expo-router";
import { useSession } from "../providers/sessionProvider";

// Unknown URLs go to the entry point of whichever side is available. Redirecting
// to a guarded route that is not available is never handled by the navigator.
export default function NotFoundScreen() {
  const { status } = useSession();
  return <Redirect href={status === "signedIn" ? "/" : "/sign-in"} />;
}
