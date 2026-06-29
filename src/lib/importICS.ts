// ─── ICS Import Parser ────────────────────────────────────────────────────────
// Handles the iCalendar format (RFC 5545)
// All UTC times are shifted to GMT+8 (Asia/Manila / Asia/Singapore)
// to match DayFlow's UTC+8 date logic throughout the app.

export interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  url?: string;
  dtStart: Date; // shifted to GMT+8 wall-clock time
  dtEnd: Date;
  isAllDay: boolean;
  dtStartDateStr: string; // 'yyyy-MM-dd' in GMT+8 — use this for scheduling
  dtStartSlot: number; // DayFlow slot 0–47 in GMT+8
}

const GMT8_OFFSET_MS = 8 * 60 * 60 * 1000;

// Shift a UTC Date to GMT+8 wall-clock time represented as a local Date object.
// e.g. UTC 2026-07-02T23:59:00Z  →  Date representing 2026-07-03 07:59 local
function toGMT8(utcDate: Date): Date {
  return new Date(utcDate.getTime() + GMT8_OFFSET_MS);
}

// Format a GMT+8-shifted Date as 'yyyy-MM-dd'
function dateStrGMT8(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Convert GMT+8-shifted Date to DayFlow slot (0–47)
function slotFromGMT8(d: Date): number {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return h * 2 + (m >= 30 ? 1 : 0);
}

// Unfold iCal line continuations (lines starting with space/tab are continuations)
function unfold(raw: string): string {
  return raw.replace(/\r?\n[ \t]/g, '');
}

// Parse iCal datetime string → UTC Date
// Formats: 20260702T235900Z  |  20260702T235900  |  20260702 (date-only)
function parseICSDate(val: string, keyParams: string): { utcDate: Date; isAllDay: boolean } {
  const v = val.trim();

  // Date-only: VALUE=DATE or bare 8-digit string
  if (/^\d{8}$/.test(v) || keyParams.includes('VALUE=DATE')) {
    const y = parseInt(v.slice(0, 4));
    const mo = parseInt(v.slice(4, 6)) - 1;
    const d = parseInt(v.slice(6, 8));
    // Treat as midnight GMT+8 → UTC
    return { utcDate: new Date(Date.UTC(y, mo, d) - GMT8_OFFSET_MS), isAllDay: true };
  }

  if (/^\d{8}T\d{6}Z?$/.test(v)) {
    const y = parseInt(v.slice(0, 4));
    const mo = parseInt(v.slice(4, 6)) - 1;
    const d = parseInt(v.slice(6, 8));
    const h = parseInt(v.slice(9, 11));
    const mi = parseInt(v.slice(11, 13));
    const s = parseInt(v.slice(13, 15));

    if (v.endsWith('Z')) {
      // Explicit UTC
      return { utcDate: new Date(Date.UTC(y, mo, d, h, mi, s)), isAllDay: false };
    }

    // No Z and no TZID → Canvas/BYU stores these as UTC despite missing Z
    // (All Canvas ICS events observed use Z suffix anyway, but just in case)
    // We treat floating times as UTC to be safe
    return { utcDate: new Date(Date.UTC(y, mo, d, h, mi, s)), isAllDay: false };
  }

  return { utcDate: new Date(v), isAllDay: false };
}

// Unescape iCal text (commas, semicolons, newlines)
function unescapeText(val: string): string {
  return val
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\n/gi, '\n')
    .replace(/\\\\/g, '\\')
    .trim();
}

export function parseICS(raw: string): ICSEvent[] {
  const unfolded = unfold(raw);
  const lines = unfolded.split(/\r?\n/);
  const events: ICSEvent[] = [];

  let inEvent = false;
  let current: {
    uid?: string;
    summary?: string;
    description?: string;
    url?: string;
    dtStartUTC?: Date;
    dtEndUTC?: Date;
    isAllDay?: boolean;
  } = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;
      if (current.summary && current.dtStartUTC) {
        const dtEndUTC = current.dtEndUTC ?? current.dtStartUTC;
        const isAllDay = current.isAllDay ?? false;

        // Shift both times to GMT+8
        const dtStart = toGMT8(current.dtStartUTC);
        const dtEnd = toGMT8(dtEndUTC);

        events.push({
          uid: current.uid ?? `ics-${Math.random()}`,
          summary: current.summary,
          ...(current.description ? { description: current.description } : {}),
          ...(current.url ? { url: current.url } : {}),
          dtStart,
          dtEnd,
          isAllDay,
          dtStartDateStr: dateStrGMT8(dtStart),
          dtStartSlot: isAllDay ? 16 : slotFromGMT8(dtStart), // all-day → 8 AM default
        });
      }
      current = {};
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const keyFull = line.slice(0, colonIdx).toUpperCase();
    const val = line.slice(colonIdx + 1);
    const baseKey = keyFull.split(';')[0] ?? keyFull;
    const keyParams = keyFull; // full key including params for VALUE=DATE check

    switch (baseKey) {
      case 'UID':
        current.uid = val.trim();
        break;
      case 'SUMMARY':
        current.summary = unescapeText(val);
        break;
      case 'DESCRIPTION':
        current.description = unescapeText(val);
        break;
      case 'URL': {
        current.url = val.trim();
        break;
      }
      case 'DTSTART': {
        const { utcDate, isAllDay } = parseICSDate(val, keyParams);
        current.dtStartUTC = utcDate;
        current.isAllDay = isAllDay;
        break;
      }
      case 'DTEND': {
        const { utcDate } = parseICSDate(val, keyParams);
        current.dtEndUTC = utcDate;
        break;
      }
    }
  }

  return events;
}

// Fetch ICS from a URL (tries direct, falls back to CORS proxy)
export async function fetchICS(url: string): Promise<ICSEvent[]> {
  let text: string;
  try {
    const res = await fetch(url, { headers: { Accept: 'text/calendar' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch {
    const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxy);
    if (!res.ok) throw new Error(`Proxy fetch failed: HTTP ${res.status}`);
    text = await res.text();
  }

  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error('Not a valid iCal file');
  }

  return parseICS(text);
}
