export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toCanonicalDateOnly(date: Date | string): string | null {
  if (!date) return null;

  if (date instanceof Date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
  if (iso.test(date)) return date;

  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = date.match(dmy);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  return null;
}

export function canonicalToDisplayDate(canonical: string | null): string {
  if (!canonical) return "";
  const [y, m, d] = canonical.split("-");
  return `${d}/${m}/${y}`;
}
``
