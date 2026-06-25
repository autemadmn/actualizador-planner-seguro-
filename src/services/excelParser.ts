import type ExcelJS from 'exceljs';
import type { DetectedColumns, ParsedCell, ParsedPlannerSheet, ParsedRow } from '../types/excel';
import { detectColumns, HEADER_ROW_NUMBER } from '../utils/columnDetection';
import { formatDateForSpain, normalizeExcelDateValue } from '../utils/dateUtils';
import { hasUsefulText, normalizeText } from '../utils/normalizeText';

const FIRST_DATA_ROW = 10;

type Worksheet = ExcelJS.Worksheet;
type Row = ExcelJS.Row;
type Cell = ExcelJS.Cell;

export function cellDisplayText(cell: Cell): string {
  const value = cell.value;

  if (value instanceof Date) {
    return formatDateForSpain(normalizeExcelDateValue(value));
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => String(item.text ?? '')).join('');
    }

    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }

    if ('result' in value) {
      return String(value.result ?? '');
    }
  }

  return cell.text ?? '';
}

function dateAwareDisplayText(cell: Cell, normalizedDate: string | null): string {
  if (normalizedDate) {
    return formatDateForSpain(normalizedDate);
  }

  return cellDisplayText(cell);
}

function collectHeaders(row: Row): Map<number, string> {
  const headers = new Map<number, string>();
  const lastColumn = Math.max(row.cellCount, row.actualCellCount);

  for (let columnIndex = 1; columnIndex <= lastColumn; columnIndex += 1) {
    const header = cellDisplayText(row.getCell(columnIndex));
    if (hasUsefulText(header)) {
      headers.set(columnIndex, header);
    }
  }

  return headers;
}

function getIndentationLevel(cell: Cell, taskName: string): number {
  const alignmentIndent = Number(cell.alignment?.indent ?? 0);
  const leadingSpaces = taskName.match(/^\s*/)?.[0].length ?? 0;
  return Math.max(alignmentIndent, Math.floor(leadingSpaces / 2));
}

function getBoldState(row: Row, nameCell: Cell): boolean {
  return Boolean(nameCell.font?.bold || row.font?.bold);
}

function buildParsedCells(row: Row, columns: DetectedColumns): ParsedCell[] {
  return columns.visibleColumns.map((column) => {
    const cell = row.getCell(column.index);
    const normalizedDate =
      column.role === 'startDate' || column.role === 'endDate'
        ? normalizeExcelDateValue(cell.value, cell.text)
        : null;

    return {
      columnIndex: column.index,
      header: column.header,
      value: cell.value,
      displayValue: dateAwareDisplayText(cell, normalizedDate),
    };
  });
}

function parseDataRow(row: Row, columns: DetectedColumns): ParsedRow | null {
  const cells = buildParsedCells(row, columns);
  const hasContent = cells.some((cell) => hasUsefulText(cell.displayValue));
  if (!hasContent) {
    return null;
  }

  const originalValues: Record<number, unknown> = {};
  const displayValues: Record<number, string> = {};

  for (const cell of cells) {
    originalValues[cell.columnIndex] = cell.value;
    displayValues[cell.columnIndex] = cell.displayValue;
  }

  const nameCell = row.getCell(columns.nameColumnIndex);
  const assigneeCell = row.getCell(columns.assigneeColumnIndex);
  const startDateCell = row.getCell(columns.startDateColumnIndex);
  const endDateCell = row.getCell(columns.endDateColumnIndex);
  const taskName = cellDisplayText(nameCell);
  const assignee = cellDisplayText(assigneeCell);

  return {
    excelRowNumber: row.number,
    originalValues,
    displayValues,
    cells,
    taskName,
    normalizedTaskName: normalizeText(taskName),
    assignee,
    normalizedAssignee: normalizeText(assignee),
    startDate: normalizeExcelDateValue(startDateCell.value, startDateCell.text),
    endDate: normalizeExcelDateValue(endDateCell.value, endDateCell.text),
    isBold: getBoldState(row, nameCell),
    indentationLevel: getIndentationLevel(nameCell, taskName),
  };
}

export function parsePlannerWorksheet(worksheet: Worksheet, fileName: string): ParsedPlannerSheet {
  const headers = collectHeaders(worksheet.getRow(HEADER_ROW_NUMBER));
  const columns = detectColumns(headers);
  const rows: ParsedRow[] = [];
  const projectName = cellDisplayText(worksheet.getCell('B1')).trim();

  for (let rowIndex = FIRST_DATA_ROW; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const parsedRow = parseDataRow(worksheet.getRow(rowIndex), columns);
    if (parsedRow) {
      rows.push(parsedRow);
    }
  }

  return {
    fileName,
    sheetName: worksheet.name,
    projectName,
    columns,
    rows,
  };
}
