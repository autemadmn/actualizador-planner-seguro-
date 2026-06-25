import type { DateFieldKey, ParsedRow } from './excel';

export type RowStatus = 'unchanged' | 'date_changed' | 'unmatched' | 'ambiguous';

export type SourceChangeStatus =
  | 'ready'
  | 'blocked'
  | 'ambiguous'
  | 'not_found'
  | 'project_blocked'
  | 'no_change';

export interface DateChange {
  field: DateFieldKey;
  label: string;
  previous: string | null;
  current: string | null;
}

export interface ComparedRow {
  currentRow: ParsedRow;
  previousRow: ParsedRow | null;
  status: RowStatus;
  sourceStatus?: SourceChangeStatus;
  observation?: string;
  changedFields: DateFieldKey[];
  changes: DateChange[];
  isAmbiguous: boolean;
  suggestedMatches: ParsedRow[];
}

export interface FilterOption {
  value: string;
  label: string;
  normalized: string;
  indentationLevel?: number;
  isBold?: boolean;
}

export interface FilteredRowsResult {
  rows: ComparedRow[];
  visibleCount: number;
  changedCount: number;
  unmatchedCount: number;
}
