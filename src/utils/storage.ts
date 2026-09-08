/**
 * Utility functions for date manipulation and optional offline fallback caching.
 */

export const STORAGE_KEYS = {
  ACTIVITIES_CACHE: 'sharink_cache_activities',
  AREAS_CACHE: 'sharink_cache_areas',
};

/**
 * Returns today's date formatted as YYYY-MM-DD.
 */
export function getTodayDateString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

/**
 * Optional offline cache saving for activities.
 */
export function cacheActivitiesLocally(data: unknown): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES_CACHE, JSON.stringify(data));
  } catch {
    // Silently ignore storage quota or private browsing errors
  }
}

/**
 * Optional offline cache loading for activities.
 */
export function loadCachedActivitiesLocally<T>(): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITIES_CACHE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Optional offline cache saving for life areas.
 */
export function cacheAreasLocally(data: unknown): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AREAS_CACHE, JSON.stringify(data));
  } catch {
    // Silently ignore storage quota or private browsing errors
  }
}

/**
 * Optional offline cache loading for life areas.
 */
export function loadCachedAreasLocally<T>(): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AREAS_CACHE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
