/**
 * Returns the current date and time in Pacific Standard Time, formatted for prompts.
 * Example: "Tuesday, February 4, 2026 at 2:35 PM PST"
 */
export function getCurrentPSTDateTime(): string {
  const now = new Date();

  // Format in PST timezone
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles',
  };

  const formatted = now.toLocaleString('en-US', options);
  return `${formatted} PST`;
}

/**
 * Converts relative date strings (from AI extraction) to ISO 8601 timestamps.
 * Examples: "tomorrow morning", "Friday", "end of day", "next week"
 */
export function convertRelativeDate(relativeDate: string | null): string | null {
  if (!relativeDate) return null;

  const now = new Date();
  const lower = relativeDate.toLowerCase().trim();

  // Already ISO format - validate and return
  if (/^\d{4}-\d{2}-\d{2}/.test(relativeDate)) {
    try {
      return new Date(relativeDate).toISOString();
    } catch {
      return null;
    }
  }

  // Today variants
  if (lower === 'today' || lower.includes('end of day') || lower === 'eod' || lower.includes('this evening')) {
    const d = new Date(now);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  // This morning/afternoon
  if (lower === 'this morning') {
    const d = new Date(now);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  if (lower === 'this afternoon') {
    const d = new Date(now);
    d.setHours(14, 0, 0, 0);
    return d.toISOString();
  }

  // Tomorrow variants
  if (lower.includes('tomorrow')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    if (lower.includes('morning')) {
      d.setHours(9, 0, 0, 0);
    } else if (lower.includes('afternoon')) {
      d.setHours(14, 0, 0, 0);
    } else if (lower.includes('evening') || lower.includes('night')) {
      d.setHours(18, 0, 0, 0);
    } else {
      d.setHours(9, 0, 0, 0); // Default to morning
    }
    return d.toISOString();
  }

  // Day names (Friday, Monday, etc.)
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i])) {
      const d = new Date(now);
      const currentDay = d.getDay();
      let daysUntil = i - currentDay;
      if (daysUntil <= 0) daysUntil += 7; // Next occurrence
      d.setDate(d.getDate() + daysUntil);

      // Check for morning/afternoon/evening modifiers
      if (lower.includes('morning')) {
        d.setHours(9, 0, 0, 0);
      } else if (lower.includes('afternoon')) {
        d.setHours(14, 0, 0, 0);
      } else if (lower.includes('evening')) {
        d.setHours(18, 0, 0, 0);
      } else {
        d.setHours(9, 0, 0, 0); // Default to morning
      }
      return d.toISOString();
    }
  }

  // Next week
  if (lower.includes('next week')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  // End of week
  if (lower.includes('end of week') || lower.includes('end of the week')) {
    const d = new Date(now);
    const daysUntilFriday = (5 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilFriday);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  // ASAP / immediately - set to end of today
  if (lower === 'asap' || lower === 'immediately' || lower === 'now') {
    const d = new Date(now);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  // "in X days"
  const inDaysMatch = lower.match(/in (\d+) days?/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  // "in X hours"
  const inHoursMatch = lower.match(/in (\d+) hours?/);
  if (inHoursMatch) {
    const hours = parseInt(inHoursMatch[1], 10);
    const d = new Date(now);
    d.setHours(d.getHours() + hours);
    return d.toISOString();
  }

  // Couldn't parse - return null (no deadline)
  console.log(`Could not parse relative date: "${relativeDate}"`);
  return null;
}
