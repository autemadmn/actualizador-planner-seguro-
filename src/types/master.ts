import type ExcelJS from 'exceljs';
import type { ComparedRow, DateChange } from './comparison';

export type MasterValidationStatus = 'valid' | 'missing_project' | 'not_found' | 'ambiguous';
export type MasterChangeStatus =
  | 'ready'
  | 'blocked'
  | 'ambiguous'
  | 'not_found'
  | 'project_blocked'
  | 'no_change';

export interface MasterColumnInfo {
  index: number;
  header: string;
  normalizedHeader: string;
}

export interface MasterSheetColumns {
  headerRowNumber: number;
  nameColumnIndex: number;
  assigneeColumnIndex: number | null;
  statusColumnIndex: number | null;
  observationsColumnIndex: number | null;
  startDateColumnIndex: number | null;
  endDateColumnIndex: number | null;
  dateColumns: MasterColumnInfo[];
}

export interface MasterRow {
  worksheetName: string;
  rowNumber: number;
  taskName: string;
  normalizedTaskName: string;
  assignee: string;
  status: string;
  observations: string;
  columns: MasterSheetColumns;
}

export interface MasterProjectCandidate {
  worksheetName: string;
  cellAddress: string;
  value: string;
  normalizedValue: string;
  source: 'sheet' | 'cell';
}

export interface ParsedMasterWorkbook {
  fileName: string;
  workbook: ExcelJS.Workbook;
  rows: MasterRow[];
  projectCandidates: MasterProjectCandidate[];
}

export interface MasterProjectValidation {
  status: MasterValidationStatus;
  projectName: string;
  normalizedProjectName: string;
  worksheetName: string | null;
  message: string;
}

export interface MasterFieldChange {
  field: DateChange['field'];
  label: string;
  masterColumnIndex: number;
  previous: string | null;
  current: string | null;
}

export interface MasterChangeCandidate {
  id: string;
  comparedRow: ComparedRow;
  masterRow: MasterRow | null;
  projectName: string;
  validation: MasterProjectValidation;
  status: MasterChangeStatus;
  changes: MasterFieldChange[];
  observation: string;
}
