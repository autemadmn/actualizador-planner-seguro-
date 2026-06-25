import type { ComparedRow } from '../types/comparison';
import type { ExcelColumnInfo, ParsedCell, ParsedRow } from '../types/excel';
import type { TrackingDateState, TrackingDateValue, TrackingRow } from '../types/tracking';
import { normalizeText } from '../utils/normalizeText';

const trackingColumns: ExcelColumnInfo[] = [
  { index: 1, letter: 'A', header: 'Division', normalizedHeader: 'division', role: 'other' },
  { index: 2, letter: 'B', header: 'Producto', normalizedHeader: 'producto', role: 'other' },
  { index: 3, letter: 'C', header: 'Version HW', normalizedHeader: 'version hw', role: 'other' },
  { index: 4, letter: 'D', header: 'Manual usuario', normalizedHeader: 'manual usuario', role: 'other' },
  { index: 5, letter: 'E', header: 'Detalle documento', normalizedHeader: 'detalle documento', role: 'name' },
  { index: 6, letter: 'F', header: 'Tipo', normalizedHeader: 'tipo', role: 'other' },
  { index: 7, letter: 'G', header: 'Responsable', normalizedHeader: 'responsable', role: 'assignee' },
  { index: 8, letter: 'H', header: 'Estado', normalizedHeader: 'estado', role: 'other' },
  { index: 9, letter: 'I', header: 'Publicacion planificada', normalizedHeader: 'publicacion planificada', role: 'startDate' },
  { index: 10, letter: 'J', header: 'Publicacion real', normalizedHeader: 'publicacion real', role: 'other' },
  { index: 11, letter: 'K', header: 'Recepcion prevista', normalizedHeader: 'recepcion prevista', role: 'other' },
  { index: 12, letter: 'L', header: 'Recepcion real', normalizedHeader: 'recepcion real', role: 'other' },
  { index: 13, letter: 'M', header: 'Deadline manual', normalizedHeader: 'deadline manual', role: 'endDate' },
  { index: 14, letter: 'N', header: 'Comentarios', normalizedHeader: 'comentarios', role: 'other' },
  { index: 15, letter: 'O', header: 'Notas', normalizedHeader: 'notas', role: 'other' },
];

const dateStateText: Record<TrackingDateState, string> = {
  completed: 'Completado',
  overdue: 'Vencido',
  planned: 'Planificado',
  tbd: 'TBD',
  unknown: 'Sin fecha',
};

function dateDisplay(value: TrackingDateValue): string {
  return value.display || '';
}

function preferredStartDate(row: TrackingRow): string | null {
  return (
    row.expectedReceptionDate.canonical ??
    row.plannedPublicationDate.canonical ??
    row.realReceptionDate.canonical ??
    row.realPublicationDate.canonical
  );
}

function preferredDueDate(row: TrackingRow): string | null {
  return (
    row.manualDeliveryDeadline.canonical ??
    row.plannedPublicationDate.canonical ??
    row.expectedReceptionDate.canonical ??
    row.realPublicationDate.canonical
  );
}

function valuesForTrackingRow(row: TrackingRow): Record<number, string> {
  return {
    1: row.division,
    2: row.product,
    3: row.hardwareVersion,
    4: row.manualUser,
    5: row.documentDetail,
    6: row.deliveryType,
    7: row.owner,
    8: row.status || dateStateText[row.dateState],
    9: dateDisplay(row.plannedPublicationDate),
    10: dateDisplay(row.realPublicationDate),
    11: dateDisplay(row.expectedReceptionDate),
    12: dateDisplay(row.realReceptionDate),
    13: dateDisplay(row.manualDeliveryDeadline),
    14: row.comments,
    15: row.notes,
  };
}

function parsedRowFromTracking(row: TrackingRow): ParsedRow {
  const displayValues = valuesForTrackingRow(row);
  const cells: ParsedCell[] = trackingColumns.map((column) => ({
    columnIndex: column.index,
    header: column.header,
    value: displayValues[column.index] ?? '',
    displayValue: displayValues[column.index] ?? '',
  }));
  const taskName = row.documentDetail || row.manualUser || row.product || `Fila ${row.rowNumber}`;
  const assignee = row.owner || row.areaPerson || row.projectLead || 'Sin asignar';

  return {
    excelRowNumber: row.rowNumber,
    originalValues: displayValues,
    displayValues,
    cells,
    taskName,
    normalizedTaskName: normalizeText(taskName),
    assignee,
    normalizedAssignee: normalizeText(assignee),
    startDate: preferredStartDate(row),
    endDate: preferredDueDate(row),
    isBold: false,
    indentationLevel: 0,
  };
}

export function getTrackingComparisonColumns(): ExcelColumnInfo[] {
  return trackingColumns;
}

export function rowsFromTrackingSheet(rows: TrackingRow[]): ComparedRow[] {
  return rows.map((row) => {
    const currentRow = parsedRowFromTracking(row);
    const isOverdue = row.dateState === 'overdue';

    return {
      currentRow,
      previousRow: currentRow,
      status: isOverdue ? 'date_changed' : 'unchanged',
      sourceStatus: isOverdue ? 'ready' : 'no_change',
      changedFields: isOverdue ? ['endDate'] : [],
      changes: [],
      isAmbiguous: false,
      observation: row.comments || row.notes || '',
      suggestedMatches: [],
    };
  });
}
