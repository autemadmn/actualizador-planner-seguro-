export interface PlannerCell {
  header: string;
  address: string;
  rawValue: unknown;
  displayValue: string;
  canonicalDates?: string[];
}

export interface PlannerTaskRow {
  excelRowNumber: number;
  taskName: string;
  assignee: string;
  startDate: string | null;
  endDate: string | null;
  duration: string;
  observations: string;
  cells: PlannerCell[];
}

export interface ParsedPlannerSheet {
  sheetName: string;
  headerRowNumber: number;
  tasks: PlannerTaskRow[];
}
