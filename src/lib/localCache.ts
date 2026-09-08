/**
 * Small IndexedDB-backed cache used to make DayFlow cache-first.
 *
 * Large app data lives in IndexedDB (not localStorage, which is synchronous and
 * too small for trade history). Tiny sync metadata stays in localStorage.
 * Every key is scoped by the signed-in Supabase user id.
 */
const DB_NAME = 'dayflow-local-cache';
const DB_VERSION = 1;
const STORE_NAME = 'collections';
const META_PREFIX = 'dayflow-cache-meta:';

interface CacheRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt: number;
}

export interface CacheMeta {
  lastFullSyncAt?: number | undefined;
  lastIncrementalSyncAt?: number | undefined;
  lastCreatedAt?: string | undefined;
  version?: number | undefined;
}

let dbPromise: Promise<IDBDatabase> | null = null;
const memoryFallback = new Map<string, unknown>();

function scopedKey(userId: string, key: string): string {
  return `${userId}:${key}`;
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
  });
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = work(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

export async function getLocalCache<T>(userId: string, key: string): Promise<T | null> {
  const fullKey = scopedKey(userId, key);
  try {
    const record = await withStore<CacheRecord<T> | undefined>('readonly', (store) => store.get(fullKey));
    return record?.value ?? null;
  } catch {
    return (memoryFallback.get(fullKey) as T | undefined) ?? null;
  }
}

export async function setLocalCache<T>(userId: string, key: string, value: T): Promise<void> {
  const fullKey = scopedKey(userId, key);
  memoryFallback.set(fullKey, value);
  try {
    await withStore<IDBValidKey>('readwrite', (store) =>
      store.put({ key: fullKey, value, updatedAt: Date.now() } satisfies CacheRecord<T>)
    );
  } catch {
    // Memory fallback already contains the value. Cache failure must never block the app.
  }
}

export async function deleteLocalCache(userId: string, key: string): Promise<void> {
  const fullKey = scopedKey(userId, key);
  memoryFallback.delete(fullKey);
  try {
    await withStore<undefined>('readwrite', (store) => store.delete(fullKey) as IDBRequest<undefined>);
  } catch {
    // Best-effort cache cleanup.
  }
}

export function getCacheMeta(userId: string, key: string): CacheMeta {
  try {
    const raw = localStorage.getItem(`${META_PREFIX}${scopedKey(userId, key)}`);
    return raw ? (JSON.parse(raw) as CacheMeta) : {};
  } catch {
    return {};
  }
}

export function setCacheMeta(userId: string, key: string, patch: CacheMeta): CacheMeta {
  const next = { ...getCacheMeta(userId, key), ...patch };
  try {
    localStorage.setItem(`${META_PREFIX}${scopedKey(userId, key)}`, JSON.stringify(next));
  } catch {
    // Metadata is an optimisation only.
  }
  return next;
}

export function clearCacheMeta(userId: string, key: string): void {
  try {
    localStorage.removeItem(`${META_PREFIX}${scopedKey(userId, key)}`);
  } catch {
    // Best effort.
  }
}

export function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}
