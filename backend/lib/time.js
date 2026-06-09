const DEFAULT_TIME_ZONE = process.env.APP_TIMEZONE || "Europe/Moscow";

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim()) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timeZone.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function resolveTimeZone(timeZone = DEFAULT_TIME_ZONE) {
  const candidate = typeof timeZone === "string" ? timeZone.trim() : "";
  return isValidTimeZone(candidate) ? candidate : DEFAULT_TIME_ZONE;
}

function parseDateString(dateString) {
  if (typeof dateString !== "string") {
    return null;
  }

  const match = dateString.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function normalizeTimeString(timeString) {
  if (typeof timeString !== "string") {
    return null;
  }

  const match = timeString.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function getDatePartsInTimeZone(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolvedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = part.value;
    }
  }

  const hour = parts.hour === "24" ? "00" : parts.hour;

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour,
    minute: parts.minute,
    second: parts.second,
    timeZone: resolvedTimeZone,
  };
}

function getWeekdayIndexFromDateString(dateString) {
  const parsed = parseDateString(dateString);
  if (!parsed) {
    return null;
  }

  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
}

function isPastDateTime(dateString, timeString, timeZone = DEFAULT_TIME_ZONE, referenceDate = new Date()) {
  const normalizedTime = normalizeTimeString(timeString);
  const parsedDate = parseDateString(dateString);

  if (!parsedDate || !normalizedTime) {
    return false;
  }

  const current = getDatePartsInTimeZone(referenceDate, timeZone);
  if (dateString < current.date) {
    return true;
  }

  if (dateString > current.date) {
    return false;
  }

  return normalizedTime <= current.time;
}

module.exports = {
  DEFAULT_TIME_ZONE,
  getDatePartsInTimeZone,
  getWeekdayIndexFromDateString,
  isPastDateTime,
  isValidTimeZone,
  normalizeTimeString,
  parseDateString,
  resolveTimeZone,
};
