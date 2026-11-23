/**
 * Track Numbering & Title Cleaning Utilities
 *
 * Automatically detects track numbers in song titles (e.g., "01 - Faded", "01. Faded", "1. Faded", "[01] Faded", "01 Faded")
 * - Extracts track number for ascending playlist sorting (1..N)
 * - Strips leading number prefixes so clean titles are displayed in the UI while preserving natural album order
 */

const TRACK_NUM_REGEX = /^(?:(?:\[|\()(\d{1,3})(?:\]|\))[\s.\-_–—:]*|(\d{1,3})[\s.\-_–—:]+|0+(\d+)[\s]+)(.+)$/i;

/**
 * Extracts the leading track number if present, otherwise returns null.
 */
export function extractTrackNumber(title?: string | null): number | null {
  if (!title) return null;
  const trimmed = title.trim();
  const match = trimmed.match(TRACK_NUM_REGEX);
  if (!match) return null;

  const rawNum = match[1] || match[2] || match[3];
  if (!rawNum) return null;

  const num = parseInt(rawNum, 10);
  return isNaN(num) ? null : num;
}

/**
 * Cleans the title by removing leading track number prefixes (e.g. "01 - Faded" -> "Faded").
 */
export function cleanTrackTitle(title?: string | null): string {
  if (!title) return '';
  const trimmed = title.trim();
  const match = trimmed.match(TRACK_NUM_REGEX);
  if (!match) return trimmed;

  const clean = (match[4] || '').trim();
  return clean || trimmed;
}

/**
 * Sorts tracks in ascending numerical order when titles contain track numbers.
 * Tracks without track numbers remain after numbered tracks in their original relative order.
 */
export function sortTracksByNumber<T extends { title?: string | null }>(tracks: T[]): T[] {
  return [...tracks].sort((a, b) => {
    const titleA = a.title || '';
    const titleB = b.title || '';

    const numA = extractTrackNumber(titleA);
    const numB = extractTrackNumber(titleB);

    if (numA !== null && numB !== null) {
      if (numA !== numB) return numA - numB;
      return titleA.localeCompare(titleB);
    }

    if (numA !== null) return -1;
    if (numB !== null) return 1;

    return 0;
  });
}
