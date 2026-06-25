import type { ParsedPlannerSheet } from "../types/excel";

export function getUniqueProjectsFromPlanner(
  sheet: ParsedPlannerSheet | null
): string[] {
  if (!sheet) return [];
  return Array.from(
    new Set(
      sheet.tasks
        .map((t) => t.cells.find(c => c.header.toLowerCase().includes("proyecto"))?.displayValue)
        .filter(Boolean)
    )
  ) as string[];
}

export function getUniqueAssigneesFromPlanner(
  sheet: ParsedPlannerSheet | null
): string[] {
  if (!sheet) return [];

  return Array.from(
    new Set(sheet.tasks.map((t) => t.assignee).filter(Boolean))
  );
}
