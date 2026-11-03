import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Project } from "@/types/project";
import type { StoredAsset } from "@/types/assets";

interface FrameDB extends DBSchema {
  projects: { key: string; value: Project; indexes: { updatedAt: number } };
  thumbnails: { key: string; value: { id: string; blob: Blob; updatedAt: number } };
  assets: { key: string; value: StoredAsset; indexes: { kind: string; createdAt: number } };
  kv: { key: string; value: unknown };
}

const DB_NAME = "frame-studio";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FrameDB>> | null = null;

export function getDB() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available in this environment"));
  if (!dbPromise) {
    dbPromise = openDB<FrameDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const p = db.createObjectStore("projects", { keyPath: "id" });
        p.createIndex("updatedAt", "updatedAt");
        db.createObjectStore("thumbnails", { keyPath: "id" });
        const a = db.createObjectStore("assets", { keyPath: "id" });
        a.createIndex("kind", "kind");
        a.createIndex("createdAt", "createdAt");
        db.createObjectStore("kv");
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await getDB();
    const v = await db.get("kv", key);
    return (v as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function kvSet(key: string, value: unknown) {
  const db = await getDB();
  await db.put("kv", value, key);
}

/** Test helper: drop the cached connection (used with fake-indexeddb). */
export function __resetDBForTests() {
  dbPromise = null;
}
