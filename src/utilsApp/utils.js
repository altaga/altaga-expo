import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, PixelRatio, Platform } from "react-native";

export async function getAsyncStorageValue(label, storage = "General") {
  try {
    const session = await AsyncStorage.getItem(storage);
    if (label in JSON.parse(session)) {
      return JSON.parse(session)[label];
    } else {
      return null;
    }
  } catch {
    return null;
  }
}

export async function setAsyncStorageValue(value, storage = "General") {
  const session = await AsyncStorage.getItem(storage);
  await AsyncStorage.setItem(
    storage,
    JSON.stringify({
      ...JSON.parse(session),
      ...value,
    }),
  );
}

// Secure records (credentials, session user) live in IndexedDB, kept apart from the
// AsyncStorage cache. localStorage is only a fallback for browsers that block
// IndexedDB. Safari can still evict both; the session cookie covers that.
const IDB_NAME = "SecureStore";
const IDB_STORE = "kv";
const webFallbackKey = (storage) => `${storage}SecureFallback`;

function openSecureDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IDB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbTransaction(mode, operation) {
  const db = await openSecureDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, mode);
      const request = operation(tx.objectStore(IDB_STORE));
      // Resolve on commit, not on request success, so the write is durable.
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function readSecureRecord(storage) {
  try {
    const record = await idbTransaction("readonly", (store) => store.get(storage));
    if (record) return record;
  } catch {
    // IndexedDB blocked: read the fallback below.
  }
  return JSON.parse(localStorage.getItem(webFallbackKey(storage)) ?? "null");
}

async function writeSecureRecord(storage, record) {
  try {
    await idbTransaction("readwrite", (store) => store.put(record, storage));
    localStorage.removeItem(webFallbackKey(storage));
  } catch {
    localStorage.setItem(webFallbackKey(storage), JSON.stringify(record));
  }
}

export async function getEncryptedStorageValue(label, storage = "General") {
  try {
    const record = await readSecureRecord(storage);
    return record && label in record ? record[label] : null;
  } catch {
    return null;
  }
}

// Throws on failure. A credential that was not stored must not look stored.
export async function setEncryptedStorageValue(value, storage = "General") {
  const existing = (await readSecureRecord(storage)) ?? {};
  await writeSecureRecord(storage, { ...existing, ...value });
}

export async function clearSecureStorage(storage) {
  localStorage.removeItem(webFallbackKey(storage));
  await idbTransaction("readwrite", (store) => store.delete(storage)).catch(() => {});
}

export async function nukeStorage(storage = "General") {
  try {
    await AsyncStorage.clear();
  } catch {
    console.log("Failed to clear AsyncStorage");
  }
  await clearSecureStorage(storage);
}

export function epsilonRound(num, zeros = 4) {
  let temp = num;
  if (typeof num === "string") {
    temp = parseFloat(num);
  }
  return (
    Math.round((temp + Number.EPSILON) * Math.pow(10, zeros)) /
    Math.pow(10, zeros)
  );
}

export const normalizeFontSize = (size) => {
  let { width, height } = Dimensions.get("window");
  if (Platform.OS === "web" && height / width < 1) {
    width /= 2.3179;
    height *= 0.7668;
  }
  const scale = width / 375;
  const factor = 0.4;
  const moderateScale = 1 + (scale - 1) * factor;
  // Clamp the scale between 0.85 (min) and 1.2 (max) to prevent overlapping layouts
  const clampedScale = Math.max(0.85, Math.min(1.2, moderateScale));
  return PixelRatio.roundToNearestPixel(size * clampedScale);
};

export function useStateAsync(initialValue) {
  const [state, setState] = useState(initialValue);
  const resolverRef = useRef(null);

  const asyncSetState = useCallback((newValue) => {
    setState(newValue);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  // Resolve the promise after state updates
  useEffect(() => {
    if (resolverRef.current) {
      resolverRef.current(state);
      resolverRef.current = null;
    }
  }, [state]);

  return [state, asyncSetState];
}
