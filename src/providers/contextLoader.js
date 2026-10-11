import { useContext, useEffect } from "react";
import { readCache } from "../core/cache";
import ContextModule from "./contextModule";

// Restores the cached app state once at start. A missing or outdated cache just
// means defaults; it never touches the session.
export default function ContextLoader() {
  const { setValue } = useContext(ContextModule);

  useEffect(() => {
    readCache().then((cached) => setValue({ ...cached, hydrated: true }));
  }, [setValue]);

  return null;
}
