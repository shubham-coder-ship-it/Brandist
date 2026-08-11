/**
 * Kits cache utility — in-memory cache to avoid repeated localStorage reads.
 */

/** Generic record shape for cached kit objects (database rows). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type KitRecord = Record<string, any>;

let cache: KitRecord[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000;

export function getCachedKits(): KitRecord[] {
  if (cache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cache;
  }
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("brand-kits");
    cache = raw ? JSON.parse(raw) : [];
    cacheTimestamp = Date.now();
    return cache!;
  } catch {
    return [];
  }
}

export function invalidateCache(): void {
  cache = null;
  cacheTimestamp = 0;
}

/** Alias for getCachedKits — reads kits from localStorage (with in-memory cache). */
export const readKitsCache = getCachedKits;

/** Persists kits to localStorage and invalidates the in-memory cache. */
export function writeKitsCache(kits: KitRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("brand-kits", JSON.stringify(kits));
  } catch {
    // ignore quota errors
  }
  invalidateCache();
}
