import type { ColumnRole, DetectedColumns, ExcelColumnInfo } from '../types/excel';
import { normalizeText } from './normalizeText';

const HEADER_ROW_NUMBER = 9;
const PREFERRED_NAME_COLUMN = 3;
const PREFERRED_ASSIGNEE_COLUMN = 4;

const HEADER_ALIASES: Record<Exclude<ColumnRole, 'other'>, string[]> = {
  name: ['nombre'],
  assignee: ['asignado a'],
  startDate: ['inicio'],
  endDate: ['finalizacion'],
};

export class ColumnDetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ColumnDetectionError';
  }
}

export function columnNumberToLetter(columnNumber: number): string {
  let value = columnNumber;
  let letter = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    value = Math.floor((value - 1) / 26);
  }

  return letter;
}

function matchesRole(header: string, role: Exclude<ColumnRole, 'other'>): boolean {
  return HEADER_ALIASES[role].includes(normalizeText(header));
}

function findColumnByRole(
  headersByColumn: Map<number, string>,
  role: Exclude<ColumnRole, 'other'>,
  preferredColumn?: number,
): number | null {
  if (preferredColumn) {
    const preferredHeader = headersByColumn.get(preferredColumn);
    if (preferredHeader && matchesRole(preferredHeader, role)) {
      return preferredColumn;
    }
  }

  for (const [columnIndex, header] of headersByColumn) {
    if (matchesRole(header, role)) {
      return columnIndex;
    }
  }

  return null;
}

function getRoleForColumn(columnIndex: number, rolesByColumn: Map<number, ColumnRole>): ColumnRole {
  return rolesByColumn.get(columnIndex) ?? 'other';
}

export function detectColumns(headersByColumn: Map<number, string>): DetectedColumns {
  const nameColumnIndex = findColumnByRole(headersByColumn, 'name', PREFERRED_NAME_COLUMN);
  if (!nameColumnIndex) {
    throw new ColumnDetectionError('No se ha encontrado la columna "Nombre" en la fila 9.');
  }

  const assigneeColumnIndex = findColumnByRole(headersByColumn, 'assignee', PREFERRED_ASSIGNEE_COLUMN);
  if (!assigneeColumnIndex) {
    throw new ColumnDetectionError('No se ha encontrado la columna "Asignado a" en la fila 9.');
  }

  const startDateColumnIndex = findColumnByRole(headersByColumn, 'startDate');
  const endDateColumnIndex = findColumnByRole(headersByColumn, 'endDate');
  if (!startDateColumnIndex || !endDateColumnIndex) {
    throw new ColumnDetectionError('No se ha encontrado la columna "Inicio" o "Finalización".');
  }

  const rolesByColumn = new Map<number, ColumnRole>([
    [nameColumnIndex, 'name'],
    [assigneeColumnIndex, 'assignee'],
    [startDateColumnIndex, 'startDate'],
    [endDateColumnIndex, 'endDate'],
  ]);

  const visibleColumns: ExcelColumnInfo[] = Array.from(headersByColumn.entries())
    .filter(([, header]) => normalizeText(header).length > 0)
    .sort(([left], [right]) => left - right)
    .map(([index, header]) => ({
      index,
      letter: columnNumberToLetter(index),
      header,
      normalizedHeader: normalizeText(header),
      role: getRoleForColumn(index, rolesByColumn),
    }));

  return {
    headerRowNumber: HEADER_ROW_NUMBER,
    nameColumnIndex,
    assigneeColumnIndex,
    startDateColumnIndex,
    endDateColumnIndex,
    visibleColumns,
  };
}

export { HEADER_ROW_NUMBER };
