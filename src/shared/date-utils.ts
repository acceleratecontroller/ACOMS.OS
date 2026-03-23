/**
 * Shared date utilities for consistent timezone-aware date boundaries.
 *
 * The app is used in Australia, so all "today/tomorrow" boundaries must
 * reflect the Australian date, not UTC.  Prisma stores DateTime values
 * as UTC timestamps, so we convert Australian-midnight to UTC for queries.
 */

const APP_TIMEZONE = "Australia/Sydney";

/**
 * Get "today at midnight" in the app timezone, returned as a UTC Date
 * suitable for Prisma queries.
 *
 * For example, if it's 2026-03-24 08:00 AEDT (UTC+11), this returns
 * 2026-03-23T13:00:00.000Z (midnight AEDT expressed in UTC).
 */
export function todayInAppTz(): Date {
  // Get the current calendar date in the app timezone
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const day = parts.find((p) => p.type === "day")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const year = parts.find((p) => p.type === "year")!.value;

  // Build a date string and resolve midnight in the app timezone.
  // We use a trick: format a known instant to find the current UTC offset,
  // then compute midnight accordingly.
  const midnightLocal = `${year}-${month}-${day}T00:00:00`;

  // Create a date at that local midnight. To find the correct UTC time,
  // we use the offset: create the date in UTC, then check what the app-tz
  // clock reads, and adjust.
  // Start with a rough estimate (UTC+10 or +11 for Sydney)
  const rough = new Date(`${midnightLocal}+11:00`);

  // Verify the date is correct by checking what date the app-tz sees
  const checkParts = formatter.formatToParts(rough);
  const checkDay = checkParts.find((p) => p.type === "day")!.value;

  if (checkDay === day) {
    // The +11:00 offset was correct (AEDT)
    return rough;
  }

  // Try +10:00 (AEST)
  const fallback = new Date(`${midnightLocal}+10:00`);
  return fallback;
}

/**
 * Get date boundaries for server-side queries.
 * Returns { today, tomorrow, sevenDays, thirtyDays } as UTC Dates.
 */
export function getDateBoundaries() {
  const today = todayInAppTz();

  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const sevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  return { today, tomorrow, sevenDays, thirtyDays };
}
