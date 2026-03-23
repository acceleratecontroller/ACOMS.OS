/**
 * Calculate the next due date for a recurring task.
 *
 * - FLOATING: next due = lastCompleted + frequency
 * - FIXED:    next due = advance from the previous nextDue (anchored schedule)
 */
export function calculateNextDue(
  frequencyType: string,
  frequencyValue: number,
  scheduleType: "FIXED" | "FLOATING",
  lastCompleted: Date | null,
  currentNextDue: Date | null,
): Date | null {
  // For floating schedule, always base on when it was last completed
  // For fixed schedule, advance from the current next due date
  const baseDate =
    scheduleType === "FIXED" && currentNextDue
      ? new Date(currentNextDue)
      : lastCompleted
        ? new Date(lastCompleted)
        : null;

  if (!baseDate) return null;

  return advanceDate(baseDate, frequencyType, frequencyValue);
}

/**
 * Skip to the next weekday (Mon–Fri). If the date is already a weekday,
 * return it unchanged.
 */
function skipToNextWeekday(d: Date): Date {
  const day = d.getDay(); // 0 = Sun, 6 = Sat
  if (day === 6) d.setDate(d.getDate() + 2); // Sat → Mon
  else if (day === 0) d.setDate(d.getDate() + 1); // Sun → Mon
  return d;
}

export function advanceDate(
  date: Date,
  frequencyType: string,
  frequencyValue: number,
): Date {
  const result = new Date(date);

  switch (frequencyType) {
    case "DAILY":
      // Advance by frequencyValue weekdays (skip Sat/Sun)
      for (let i = 0; i < frequencyValue; i++) {
        result.setDate(result.getDate() + 1);
        skipToNextWeekday(result);
      }
      break;
    case "WEEKLY":
      result.setDate(result.getDate() + 7 * frequencyValue);
      break;
    case "FORTNIGHTLY":
      result.setDate(result.getDate() + 14 * frequencyValue);
      break;
    case "MONTHLY":
      result.setMonth(result.getMonth() + frequencyValue);
      break;
    case "QUARTERLY":
      result.setMonth(result.getMonth() + 3 * frequencyValue);
      break;
    case "YEARLY":
      result.setFullYear(result.getFullYear() + frequencyValue);
      break;
  }

  return result;
}
