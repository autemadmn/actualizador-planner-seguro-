export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n|\r|\n/g, ' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function makeMatchKey(taskName: string, assignee: string): string {
  return `${normalizeText(taskName)}::${normalizeText(assignee)}`;
}

export function hasUsefulText(value: unknown): boolean {
  return normalizeText(value).length > 0;
}
