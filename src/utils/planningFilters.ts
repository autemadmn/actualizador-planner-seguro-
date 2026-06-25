import type { ComparedRow, FilterOption, SourceChangeStatus } from '../types/comparison';
import { assigneeTextMatches, splitAssignees } from './assignees';
import { normalizeText } from './normalizeText';
import { inferRowHierarchy } from './plannerData';

export type PlanningChangeFilter = 'all' | 'changed' | 'unchanged' | 'unmatched' | 'blocked' | 'ambiguous';

export interface PlanningFilters {
  searchTerm: string;
  project: string;
  assignee: string;
  change: PlanningChangeFilter;
}

export const ALL_FILTER_VALUE = 'all';

export const initialPlanningFilters: PlanningFilters = {
  searchTerm: '',
  project: ALL_FILTER_VALUE,
  assignee: ALL_FILTER_VALUE,
  change: ALL_FILTER_VALUE,
};

export const planningChangeOptions: Array<{ value: PlanningChangeFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'changed', label: 'Con cambios' },
  { value: 'unchanged', label: 'Sin cambios' },
  { value: 'unmatched', label: 'Sin coincidencia' },
  { value: 'blocked', label: 'Bloqueados' },
  { value: 'ambiguous', label: 'Ambiguos' },
];

function uniqueOptionsByNormalized(options: FilterOption[]): FilterOption[] {
  const seen = new Set<string>();
  const unique: FilterOption[] = [];

  for (const option of options) {
    if (!option.normalized || seen.has(option.normalized)) {
      continue;
    }

    seen.add(option.normalized);
    unique.push(option);
  }

  return unique.sort((left, right) => left.normalized.localeCompare(right.normalized, 'es'));
}

function optionFromLabel(label: string): FilterOption | null {
  const normalized = normalizeText(label);
  if (!normalized) {
    return null;
  }

  return {
    value: label,
    label,
    normalized,
  };
}

function sourceStatusMatches(status: SourceChangeStatus | undefined, filter: PlanningChangeFilter): boolean {
  if (!status) {
    return false;
  }

  if (filter === 'unmatched') {
    return status === 'not_found';
  }

  if (filter === 'blocked') {
    return status === 'blocked' || status === 'project_blocked';
  }

  if (filter === 'ambiguous') {
    return status === 'ambiguous';
  }

  if (filter === 'unchanged') {
    return status === 'no_change';
  }

  return false;
}

export function getRowProject(row: ComparedRow, contexts: Map<ComparedRow, { project: string }>): string {
  return contexts.get(row)?.project ?? 'Sin proyecto';
}

export function buildFilterOptions(rows: ComparedRow[]): {
  projectOptions: FilterOption[];
  assigneeOptions: FilterOption[];
} {
  const contexts = inferRowHierarchy(rows);

  const projectOptions = uniqueOptionsByNormalized(
    rows
      .map((row) => optionFromLabel(getRowProject(row, contexts)))
      .filter((option): option is FilterOption => Boolean(option)),
  );

  const assigneeOptions = uniqueOptionsByNormalized(
    rows.flatMap((row) =>
      splitAssignees(row.currentRow.assignee).map((person) => ({
        value: person.label,
        label: person.label,
        normalized: person.normalized,
      })),
    ),
  );

  return { projectOptions, assigneeOptions };
}

export function matchesPlanningChangeFilter(row: ComparedRow, filter: PlanningChangeFilter): boolean {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'changed') {
    return row.changedFields.length > 0;
  }

  if (sourceStatusMatches(row.sourceStatus, filter)) {
    return true;
  }

  if (filter === 'unchanged') {
    return row.status === 'unchanged' && row.changedFields.length === 0 && row.sourceStatus !== 'blocked';
  }

  if (filter === 'unmatched') {
    return row.status === 'unmatched';
  }

  if (filter === 'ambiguous') {
    return row.status === 'ambiguous' || row.isAmbiguous;
  }

  return false;
}

export function rowSearchText(row: ComparedRow, project: string): string {
  return normalizeText(
    [
      row.currentRow.taskName,
      project,
      row.currentRow.assignee,
      row.observation,
      row.status,
      row.sourceStatus,
      ...row.currentRow.cells.map((cell) => cell.displayValue),
      ...row.changes.flatMap((change) => [change.label, change.previous, change.current]),
    ].join(' '),
  );
}

export function filterComparedRows(rows: ComparedRow[], filters: PlanningFilters): ComparedRow[] {
  const contexts = inferRowHierarchy(rows);
  const normalizedSearch = normalizeText(filters.searchTerm);
  const normalizedProject = normalizeText(filters.project);
  const selectedAssignees =
    filters.assignee === ALL_FILTER_VALUE ? new Set<string>() : new Set([normalizeText(filters.assignee)]);

  return rows.filter((row) => {
    const project = getRowProject(row, contexts);
    const matchesSearch = !normalizedSearch || rowSearchText(row, project).includes(normalizedSearch);
    const matchesProject =
      filters.project === ALL_FILTER_VALUE || normalizeText(project) === normalizedProject;
    const matchesAssignee = assigneeTextMatches(row.currentRow.assignee, selectedAssignees);
    const matchesChange = matchesPlanningChangeFilter(row, filters.change);

    return matchesSearch && matchesProject && matchesAssignee && matchesChange;
  });
}
