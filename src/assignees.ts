import { normalizeText } from "./normalizeText";

export function splitAssignees(text: string): string[] {
  if (!text) return [];
  return text.split(/[,;]+/).map((t) => t.trim());
}

export function assigneeTextMatches(
  cellValue: string,
  filter: string
): boolean {
  if (filter === "all") return true;

  const normCell = normalizeText(cellValue);
  const normFilter = normalizeText(filter);

  return normCell.includes(normFilter);
}
