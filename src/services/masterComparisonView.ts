import type { ComparedRow, DateChange, RowStatus } from '../types/comparison';
import type { ParsedPlannerSheet, ParsedRow } from '../types/excel';
import type { MasterChangeCandidate } from '../types/master';

export function rowsFromPlannerSheet(sheet: ParsedPlannerSheet | null): ComparedRow[] {
  if (!sheet) {
    return [];
  }

  return sheet.rows.map((row) => ({
    currentRow: row,
    previousRow: row,
    status: 'unchanged',
    sourceStatus: 'no_change',
    changedFields: [],
    changes: [],
    isAmbiguous: false,
    observation: '',
    suggestedMatches: [],
  }));
}

function statusFromCandidate(candidate: MasterChangeCandidate): RowStatus {
  if (candidate.status === 'ready') {
    return 'date_changed';
  }

  if (candidate.status === 'ambiguous') {
    return 'ambiguous';
  }

  if (candidate.status === 'not_found' || candidate.status === 'project_blocked') {
    return 'unmatched';
  }

  return 'unchanged';
}

function changesFromCandidate(candidate: MasterChangeCandidate): DateChange[] {
  return candidate.changes.map((change) => ({
    field: change.field,
    label: change.label,
    previous: change.previous,
    current: change.current,
  }));
}

export function rowsFromMasterCandidates(candidates: MasterChangeCandidate[]): ComparedRow[] {
  return candidates.map((candidate) => {
    const changes = changesFromCandidate(candidate);
    const status = statusFromCandidate(candidate);
    const hasSafeMasterMatch = Boolean(candidate.masterRow);
    const currentRow: ParsedRow = candidate.comparedRow.currentRow;

    return {
      currentRow,
      previousRow: hasSafeMasterMatch ? currentRow : null,
      status,
      sourceStatus: candidate.status,
      changedFields: changes.map((change) => change.field),
      changes,
      isAmbiguous: candidate.status === 'ambiguous',
      observation: candidate.observation,
      suggestedMatches: [],
    };
  });
}
