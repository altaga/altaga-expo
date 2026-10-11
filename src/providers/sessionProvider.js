import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { signedApiGet, signedApiPost } from "../core/api";
import {
  clearSecureStorage,
  getEncryptedStorageValue,
  setEncryptedStorageValue,
} from "../utilsApp/utils";
import ContextModule from "./contextModule";

// The session: who is signed in. Read AGENTS.md ("Sessions") before changing it.
// It lives in its own secure record (IndexedDB on web), apart from the app cache,
// so an update or a cache reset never signs anybody out. On web the server also
// keeps an HttpOnly cookie, which restores the session after Safari wipes storage.
const SESSION_RECORD = "Session";

const SessionContext = createContext(null);

export const useSession = () => useContext(SessionContext);

async function loadSessionUser() {
  const stored = await getEncryptedStorageValue("user", SESSION_RECORD);
  if (stored) return stored;
  if (Platform.OS !== "web") return null;
  const { user } = await signedApiGet("/api/session").catch(() => ({ user: null }));
  if (!user) return null;
  await setEncryptedStorageValue({ user }, SESSION_RECORD).catch(() => {});
  return user;
}

export default function SessionProvider({ children }) {
  const { resetValue } = useContext(ContextModule);
  const [session, setSession] = useState({ status: "loading", user: null });

  useEffect(() => {
    let active = true;
    loadSessionUser()
      .catch(() => null)
      .then((user) => {
        if (active) setSession({ status: user ? "signedIn" : "signedOut", user });
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (credentials) => {
    const { user } = await signedApiPost("/api/signIn", credentials);
    await setEncryptedStorageValue({ user }, SESSION_RECORD);
    setSession({ status: "signedIn", user });
  }, []);

  // The server must clear its cookie first; otherwise the next start would
  // restore the session. If that call fails, the user stays signed in.
  const signOut = useCallback(async () => {
    await signedApiPost("/api/signOut");
    await clearSecureStorage(SESSION_RECORD).catch(() => {});
    await resetValue();
    setSession({ status: "signedOut", user: null });
  }, [resetValue]);

  const value = useMemo(() => ({ ...session, signIn, signOut }), [session, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
