import { AdSearchFilters } from "./types";

export function normalizeDiscoverFilters(filters: AdSearchFilters): AdSearchFilters {
  const normalized: AdSearchFilters = { ...filters };

  // Remove empty arrays
  if (normalized.platforms?.length === 0) normalized.platforms = undefined;
  if (normalized.formats?.length === 0) normalized.formats = undefined;
  if (normalized.statuses?.length === 0) normalized.statuses = undefined;
  if (normalized.markets?.length === 0) normalized.markets = undefined;
  if (normalized.languages?.length === 0) normalized.languages = undefined;
  if (normalized.niches?.length === 0) normalized.niches = undefined;
  if (normalized.contentStyles?.length === 0) normalized.contentStyles = undefined;

  // Normalize runtime
  if (normalized.runtime) {
    const { minDays, maxDays } = normalized.runtime;
    if (minDays === 0 && maxDays === undefined) {
      normalized.runtime = undefined; // 0 to infinity means any runtime
    } else if (minDays === undefined && maxDays === undefined) {
      normalized.runtime = undefined;
    }
  }

  // Normalize video length
  if (normalized.videoLength) {
    const { minSeconds, maxSeconds } = normalized.videoLength;
    if (minSeconds === 0 && maxSeconds === undefined) {
      normalized.videoLength = undefined; // 0 to infinity means any length
    } else if (minSeconds === undefined && maxSeconds === undefined) {
      normalized.videoLength = undefined;
    }
  }

  // Cleanup legacy values if they mean "all" or "any"
  if (normalized.status === "all") normalized.status = undefined;
  if (normalized.mediaType === "all") normalized.mediaType = undefined;
  if (normalized.country === "ALL") normalized.country = undefined;

  // Empty string query shouldn't be counted
  if (typeof normalized.query === "string" && !normalized.query.trim()) {
    normalized.query = undefined;
  }

  return normalized;
}

export function getActiveFilterCount(filters: AdSearchFilters): number {
  const normalized = normalizeDiscoverFilters(filters);
  let count = 0;

  count += (normalized.formats?.length || 0);
  count += (normalized.statuses?.length || 0);
  count += (normalized.markets?.length || 0);
  count += (normalized.languages?.length || 0);
  count += (normalized.niches?.length || 0);
  count += (normalized.contentStyles?.length || 0);
  
  if (normalized.runtime) count += 1;
  if (normalized.videoLength) count += 1;
  if (normalized.platforms?.length) count += normalized.platforms.length;

  // Include legacy formats if plurals aren't used
  if (normalized.mediaType && !normalized.formats?.length) count += 1;
  if (normalized.status && !normalized.statuses?.length) count += 1;
  if (normalized.country && !normalized.markets?.length) count += 1;

  return count;
}
