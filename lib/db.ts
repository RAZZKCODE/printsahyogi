import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface PrintSahyogiDB extends DBSchema {
  appState: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<PrintSahyogiDB>> | undefined;

export function getAppDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser.");
  }

  dbPromise ??= openDB<PrintSahyogiDB>("printsahyogi", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("appState")) db.createObjectStore("appState");
    }
  });

  return dbPromise;
}

export async function readPersistedState<T>(key: string): Promise<T | undefined> {
  return (await getAppDB()).get("appState", key) as Promise<T | undefined>;
}

export async function writePersistedState<T>(key: string, value: T): Promise<void> {
  await (await getAppDB()).put("appState", value, key);
}
