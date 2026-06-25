import { useMemo } from 'react';
import type { ComparedRow, FilteredRowsResult, FilterOption } from '../types/comparison';
import type { PlanningFilters } from '../utils/planningFilters';
import { buildFilterOptions, filterComparedRows } from '../utils/planningFilters';

export function useFilterOptions(rows: ComparedRow[]): {
  projectOptions: FilterOption[];
  assigneeOptions: FilterOption[];
} {
  return useMemo(() => buildFilterOptions(rows), [rows]);
}

export function useFilteredRows(rows: ComparedRow[], filters: PlanningFilters): FilteredRowsResult {
  return useMemo(() => {
    const filteredRows = filterComparedRows(rows, filters);

    return {
      rows: filteredRows,
      visibleCount: filteredRows.length,
      changedCount: filteredRows.filter((row) => row.changedFields.length > 0).length,
      unmatchedCount: filteredRows.filter((row) => row.status === 'unmatched').length,
    };
  }, [filters, rows]);
}
