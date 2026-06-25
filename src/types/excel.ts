export type DateFieldKey = 'startDate' | 'endDate';

export type ColumnRole = 'name' | 'assignee' | 'startDate' | 'endDate' | 'other';

export interface ExcelColumnInfo {
  index: number;
  letter: string;
  header: string;
  normalizedHeader: string;
  role: ColumnRole;
}

export interface DetectedColumns {
  headerRowNumber: number;
  nameColumnIndex: number;
  assigneeColumnIndex: number;
  startDateColumnIndex: number;
  endDateColumnIndex: number;
  visibleColumns: ExcelColumnInfo[];
}

export interface ParsedCell {
  columnIndex: number;
  header: string;
  value: unknown;
  displayValue: string;
}

export interface ParsedRow {
  excelRowNumber: number;
  originalValues: Record<number, unknown>;
  displayValues: Record<number, string>;
  cells: ParsedCell[];
  taskName: string;
  normalizedTaskName: string;
  assignee: string;
  normalizedAssignee: string;
  startDate: string | null;
  endDate: string | null;
  isBold: boolean;
  indentationLevel: number;
}

export interface ParsedPlannerSheet {
  fileName: string;
  sheetName: string;
  projectName: string;
  columns: DetectedColumns;
  rows: ParsedRow[];
}

export type UploadSlot = 'previous' | 'current';
