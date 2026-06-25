import type { ComparedRow } from '../types/comparison';

export interface RowHierarchyContext {
  project: string;
  bucket: string;
}

const DEFAULT_PROJECT = 'Sin proyecto';
const DEFAULT_BUCKET = 'Planificacion';

export function inferRowHierarchy(rows: ComparedRow[]): Map<ComparedRow, RowHierarchyContext> {
  const contexts = new Map<ComparedRow, RowHierarchyContext>();
  let currentProject = DEFAULT_PROJECT;
  let currentBucket = DEFAULT_BUCKET;

  for (const row of rows) {
    const name = row.currentRow.taskName.trim();

    if (row.currentRow.isBold && name) {
      if (row.currentRow.indentationLevel <= 0) {
        currentProject = name;
        currentBucket = DEFAULT_BUCKET;
      } else {
        currentBucket = name;
      }
    }

    contexts.set(row, {
      project: currentProject,
      bucket: currentBucket,
    });
  }

  return contexts;
}

export function getDueDate(row: ComparedRow): string | null {
  return row.currentRow.endDate ?? row.currentRow.startDate;
}

export function getPreviousDueDate(row: ComparedRow): string | null {
  if (!row.previousRow) {
    return null;
  }

  return row.previousRow.endDate ?? row.previousRow.startDate;
}

export function isStructuralRow(row: ComparedRow): boolean {
  return (
    row.currentRow.isBold &&
    !row.currentRow.assignee.trim() &&
    !row.currentRow.startDate &&
    !row.currentRow.endDate
  );
}

export function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return 'SA';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
