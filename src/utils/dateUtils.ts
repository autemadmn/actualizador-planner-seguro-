const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

type ExcelLikeObject = {
  result?: unknown;
  text?: unknown;
  richText?: Array<{ text?: unknown }>;
  formula?: unknown;
  hyperlink?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function ymdFromParts(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function canonicalFromParts(year: number, month: number, day: number): string | null {
  return ymdFromParts(year, month, day);
}

function unwrapExcelValue(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const excelValue = value as ExcelLikeObject;
  if ('result' in excelValue) {
    return unwrapExcelValue(excelValue.result);
  }

  if (typeof excelValue.text === 'string') {
    return excelValue.text;
  }

  if (Array.isArray(excelValue.richText)) {
    return excelValue.richText.map((part) => String(part.text ?? '')).join('');
  }

  return value;
}

function normalizeDateFromString(value: string): string | null {
  const text = value.trim();
  if (!text) {
    return null;
  }

  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return ymdFromParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const spanishMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (spanishMatch) {
    const rawYear = Number(spanishMatch[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return ymdFromParts(year, Number(spanishMatch[2]), Number(spanishMatch[1]));
  }

  const dottedMatch = text.match(/^(\d{1,2})[.](\d{1,2})[.](\d{2,4})$/);
  if (dottedMatch) {
    const rawYear = Number(dottedMatch[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return ymdFromParts(year, Number(dottedMatch[2]), Number(dottedMatch[1]));
  }

  return null;
}

export function excelSerialToCanonicalDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial > 2958465) {
    return null;
  }

  const wholeDays = Math.floor(serial);
  const utcTime = EXCEL_EPOCH_UTC + wholeDays * MS_PER_DAY;
  const date = new Date(utcTime);

  return canonicalFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function canonicalDateToExcelSerial(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const canonical = normalizeDateFromString(value);
  if (!canonical) {
    return null;
  }

  const [year, month, day] = canonical.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);

  return Math.round((target - EXCEL_EPOCH_UTC) / MS_PER_DAY);
}

export function toCanonicalDateOnly(value: unknown): string | null {
  const unwrapped = unwrapExcelValue(value);

  if (unwrapped === null || unwrapped === undefined || unwrapped === '') {
    return null;
  }

  if (unwrapped instanceof Date && !Number.isNaN(unwrapped.getTime())) {
    return canonicalFromParts(unwrapped.getFullYear(), unwrapped.getMonth() + 1, unwrapped.getDate());
  }

  if (typeof unwrapped === 'number') {
    return excelSerialToCanonicalDate(unwrapped);
  }

  if (typeof unwrapped === 'string') {
    return normalizeDateFromString(unwrapped);
  }

  return null;
}

export function normalizeExcelDateValue(value: unknown, displayText?: string): string | null {
  return toCanonicalDateOnly(value) ?? toCanonicalDateOnly(displayText ?? '');
}

export function extractCanonicalDatesFromText(value: string): string[] {
  const dates = new Set<string>();
  const patterns = [
    /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g,
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
    /\b\d{1,2}[.]\d{1,2}[.]\d{2,4}\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const canonical = toCanonicalDateOnly(match[0]);
      if (canonical) {
        dates.add(canonical);
      }
    }
  }

  return Array.from(dates);
}

export function formatDateForSpain(value: string | null): string {
  if (!value) {
    return '';
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return value;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function addDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}
