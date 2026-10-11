import AsyncStorage from "@react-native-async-storage/async-storage";

// Plain app cache (AsyncStorage, which is localStorage on web). It can be lost at
// any time: Safari evicts it, and a CACHE_VERSION bump discards it. Never store
// the session, credentials or anything that cannot be fetched again here.
const CACHE_KEY = "AppCache";

// Bump when the cached shape changes. Only the cache resets; the session survives.
const CACHE_VERSION = 1;

export async function readCache() {
  try {
    const record = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) ?? "null");
    return record?.version === CACHE_VERSION ? (record.state ?? {}) : {};
  } catch {
    return {};
  }
}

export async function writeCache(partial) {
  const state = { ...(await readCache()), ...partial };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, state }));
}

export async function clearCache() {
  await AsyncStorage.removeItem(CACHE_KEY);
}
