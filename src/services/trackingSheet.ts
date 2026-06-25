import ExcelJS from 'exceljs';
import type {
  ParsedTrackingSheet,
  ParsedTrackingWorkbook,
  TrackingColumnInfo,
  TrackingColumnKey,
  TrackingDateState,
  TrackingDateValue,
  TrackingDeliveryType,
  TrackingOwnerSource,
  TrackingRow,
  TrackingSourceKind,
} from '../types/tracking';
import { formatDateForSpain, normalizeExcelDateValue } from '../utils/dateUtils';
import { normalizeText } from '../utils/normalizeText';
import { cellDisplayText } from './excelParser';
import { ExcelReadError } from './excelReader';

type Worksheet = ExcelJS.Worksheet;
type Cell = ExcelJS.Cell;

export const TRACKING_SHEET_NAME_HINT = 'seguimiento proyectos';

const MAX_HEADER_SCAN_ROWS = 8;
const TRACKING_COLUMN_COUNT = 26;

interface ColumnDefinition {
  key: TrackingColumnKey;
  fallbackIndex: number;
  aliases: string[];
}

const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { key: 'division', fallbackIndex: 1, aliases: ['division'] },
  { key: 'product', fallbackIndex: 2, aliases: ['producto'] },
  { key: 'hardwareVersion', fallbackIndex: 3, aliases: ['version hw', 'version hardware'] },
  {
    key: 'projectLead',
    fallbackIndex: 4,
    aliases: ['persona con mayor peso en el proyecto', 'mayor peso', 'maximo responsable'],
  },
  { key: 'manualUser', fallbackIndex: 5, aliases: ['manual usuario', 'tipo de manual'] },
  { key: 'documentDetail', fallbackIndex: 6, aliases: ['detalle documento', 'descripcion'] },
  { key: 'inputType', fallbackIndex: 7, aliases: ['input', 'input i'] },
  { key: 'manualType', fallbackIndex: 8, aliases: ['manual m', 'manual'] },
  {
    key: 'translatedManualType',
    fallbackIndex: 9,
    aliases: ['manual traducido', 'm-t', 'manual traducido m-t'],
  },
  { key: 'outputType', fallbackIndex: 10, aliases: ['output', 'output o'] },
  {
    key: 'plannedPublicationDate',
    fallbackIndex: 11,
    aliases: ['fecha planificada publicacion'],
  },
  {
    key: 'plannedPublicationWeek',
    fallbackIndex: 12,
    aliases: ['fecha planificada publicacion week'],
  },
  { key: 'realPublicationDate', fallbackIndex: 13, aliases: ['fecha real publicacion'] },
  { key: 'realPublicationWeek', fallbackIndex: 14, aliases: ['fecha real publicacion week'] },
  { key: 'status', fallbackIndex: 15, aliases: ['estado', 'status'] },
  { key: 'areaPerson', fallbackIndex: 16, aliases: ['area persona', 'area/persona', 'asignado', 'responsable'] },
  { key: 'expectedReceptionDate', fallbackIndex: 17, aliases: ['fecha prevista recepcion'] },
  { key: 'expectedReceptionWeek', fallbackIndex: 18, aliases: ['fecha prevista recepcion week'] },
  { key: 'realReceptionDate', fallbackIndex: 19, aliases: ['fecha real recepcion'] },
  { key: 'realReceptionWeek', fallbackIndex: 20, aliases: ['fecha real recepcion week'] },
  {
    key: 'deadlineToMeetManualDate',
    fallbackIndex: 21,
    aliases: ['fecha deadline para cumplir con fecha manual'],
  },
  { key: 'manualDeliveryDeadline', fallbackIndex: 22, aliases: ['fecha deadline entrega manual'] },
  { key: 'estimatedTime', fallbackIndex: 23, aliases: ['tiempo estimado neto'] },
  { key: 'dedicatedTime', fallbackIndex: 24, aliases: ['tiempo dedicado neto'] },
  { key: 'comments', fallbackIndex: 25, aliases: ['comentarios faltantes', 'comentarios/faltantes'] },
  { key: 'notes', fallbackIndex: 26, aliases: ['notas'] },
];

const ABSENT_VALUES = new Set(['', 'n/a', 'na', '--', '-', '?????']);

function ensureXlsxFile(file: File): void {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new ExcelReadError('El archivo seleccionado no es un archivo .xlsx valido.');
  }
}

function cleanText(value: string): string {
  const trimmed = value.replace(/\r\n|\r/g, '\n').trim();
  return ABSENT_VALUES.has(normalizeText(trimmed)) ? '' : trimmed;
}

function getCellText(row: ExcelJS.Row, columnIndex: number): string {
  return cleanText(cellDisplayText(row.getCell(columnIndex)));
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function canonicalFromParts(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseMonthFirstDate(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return canonicalFromParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (!match) {
    return null;
  }

  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  return canonicalFromParts(year, Number(match[1]), Number(match[2]));
}

function isWeekReference(value: string): boolean {
  return /^w\d{1,2}(?:[_\s-]*y?\d{2,4})?(?:\s*-->\s*w?\d{1,2})?$/i.test(value.trim());
}

function trackingDateFromCell(cell: Cell): TrackingDateValue {
  const raw = cleanText(cellDisplayText(cell));
  const normalizedRaw = normalizeText(raw);
  const isPending = normalizedRaw === 'tbd';
  const directDate =
    typeof cell.value === 'string'
      ? parseMonthFirstDate(cell.value)
      : normalizeExcelDateValue(cell.value, cell.text);
  const canonical = directDate ?? parseMonthFirstDate(raw);

  return {
    raw,
    canonical,
    display: canonical ? formatDateForSpain(canonical) : raw,
    isPending,
    isWeekReference: isWeekReference(raw),
  };
}

function headerScore(row: ExcelJS.Row): number {
  let score = 0;

  for (const definition of COLUMN_DEFINITIONS) {
    const text = normalizeText(cellDisplayText(row.getCell(definition.fallbackIndex)));
    if (definition.aliases.some((alias) => text.includes(alias))) {
      score += 2;
    }
  }

  return score;
}

function findHeaderRowNumber(worksheet: Worksheet): number {
  let bestRowNumber = 1;
  let bestScore = -1;
  const rowLimit = Math.min(worksheet.rowCount, MAX_HEADER_SCAN_ROWS);

  for (let rowNumber = 1; rowNumber <= rowLimit; rowNumber += 1) {
    const score = headerScore(worksheet.getRow(rowNumber));
    if (score > bestScore) {
      bestScore = score;
      bestRowNumber = rowNumber;
    }
  }

  return bestRowNumber;
}

function headerMatches(header: string, aliases: string[]): boolean {
  const normalizedHeader = normalizeText(header);
  return aliases.some((alias) => normalizedHeader === alias || normalizedHeader.includes(alias));
}

function buildColumnMap(worksheet: Worksheet, headerRowNumber: number): Map<TrackingColumnKey, TrackingColumnInfo> {
  const headerRow = worksheet.getRow(headerRowNumber);
  const headersByColumn = new Map<number, string>();

  for (let columnIndex = 1; columnIndex <= TRACKING_COLUMN_COUNT; columnIndex += 1) {
    headersByColumn.set(columnIndex, cleanText(cellDisplayText(headerRow.getCell(columnIndex))));
  }

  const result = new Map<TrackingColumnKey, TrackingColumnInfo>();

  for (const definition of COLUMN_DEFINITIONS) {
    const fallbackHeader = headersByColumn.get(definition.fallbackIndex) ?? '';
    const detectedIndex =
      headerMatches(fallbackHeader, definition.aliases)
        ? definition.fallbackIndex
        : Array.from(headersByColumn.entries()).find(([, header]) => headerMatches(header, definition.aliases))?.[0] ??
          definition.fallbackIndex;
    const header = headersByColumn.get(detectedIndex) || definition.aliases[0];

    result.set(definition.key, {
      key: definition.key,
      index: detectedIndex,
      header,
    });
  }

  return result;
}

function valueFor(row: ExcelJS.Row, columns: Map<TrackingColumnKey, TrackingColumnInfo>, key: TrackingColumnKey): string {
  return getCellText(row, columns.get(key)?.index ?? 1);
}

function dateFor(
  row: ExcelJS.Row,
  columns: Map<TrackingColumnKey, TrackingColumnInfo>,
  key: TrackingColumnKey,
): TrackingDateValue {
  return trackingDateFromCell(row.getCell(columns.get(key)?.index ?? 1));
}

function detectDeliveryType(row: ExcelJS.Row, columns: Map<TrackingColumnKey, TrackingColumnInfo>): {
  type: TrackingDeliveryType;
  detail: string;
} {
  const typeColumns: Array<{ key: TrackingColumnKey; type: TrackingDeliveryType; label: string }> = [
    { key: 'inputType', type: 'I', label: 'Input' },
    { key: 'manualType', type: 'M', label: 'Manual' },
    { key: 'translatedManualType', type: 'M-T', label: 'Manual traducido' },
    { key: 'outputType', type: 'O', label: 'Output' },
  ];

  const detected = typeColumns.find(({ key }) => valueFor(row, columns, key));
  if (!detected) {
    return { type: 'Sin tipo', detail: '' };
  }

  const rawDetail = valueFor(row, columns, detected.key);
  return {
    type: detected.type,
    detail: rawDetail || detected.label,
  };
}

function ownerSource(areaPerson: string, projectLead: string): TrackingOwnerSource {
  if (areaPerson) {
    return 'assigned';
  }

  return projectLead ? 'lead' : 'none';
}

function chooseOwner(areaPerson: string, projectLead: string): string {
  return areaPerson || projectLead || 'Sin asignar';
}

function hasStructuredContent(values: string[]): boolean {
  return values.some((value) => normalizeText(value).length > 0);
}

function todayCanonical(): string {
  const today = new Date();
  return canonicalFromParts(today.getFullYear(), today.getMonth() + 1, today.getDate()) ?? '9999-12-31';
}

function isCompletedStatus(status: string): boolean {
  const normalized = normalizeText(status);
  return (
    normalized.includes('publicado') ||
    normalized.includes('recibido') ||
    normalized.includes('completado') ||
    normalized === 'fo'
  );
}

function primaryPlanningDate(
  deliveryType: TrackingDeliveryType,
  plannedPublicationDate: TrackingDateValue,
  expectedReceptionDate: TrackingDateValue,
  deadlineToMeetManualDate: TrackingDateValue,
  manualDeliveryDeadline: TrackingDateValue,
): TrackingDateValue {
  if (deliveryType === 'I') {
    return expectedReceptionDate.canonical || expectedReceptionDate.isPending
      ? expectedReceptionDate
      : deadlineToMeetManualDate;
  }

  return plannedPublicationDate.canonical || plannedPublicationDate.isPending
    ? plannedPublicationDate
    : manualDeliveryDeadline;
}

function getDateState(args: {
  deliveryType: TrackingDeliveryType;
  status: string;
  plannedPublicationDate: TrackingDateValue;
  realPublicationDate: TrackingDateValue;
  expectedReceptionDate: TrackingDateValue;
  realReceptionDate: TrackingDateValue;
  deadlineToMeetManualDate: TrackingDateValue;
  manualDeliveryDeadline: TrackingDateValue;
}): TrackingDateState {
  if (isCompletedStatus(args.status) || args.realPublicationDate.canonical || args.realReceptionDate.canonical) {
    return 'completed';
  }

  const primaryDate = primaryPlanningDate(
    args.deliveryType,
    args.plannedPublicationDate,
    args.expectedReceptionDate,
    args.deadlineToMeetManualDate,
    args.manualDeliveryDeadline,
  );

  if (primaryDate.isPending) {
    return 'tbd';
  }

  if (primaryDate.canonical) {
    return primaryDate.canonical < todayCanonical() ? 'overdue' : 'planned';
  }

  return 'unknown';
}

function buildNaturalKey(row: {
  product: string;
  hardwareVersion: string;
  manualUser: string;
  documentDetail: string;
  deliveryType: TrackingDeliveryType;
}): string {
  return [row.product, row.hardwareVersion, row.manualUser, row.documentDetail, row.deliveryType]
    .map((value) => normalizeText(value))
    .join('::');
}

function buildSearchText(values: Array<string | TrackingDateValue>): string {
  return normalizeText(
    values
      .flatMap((value) => {
        if (typeof value === 'string') {
          return value;
        }

        return [value.raw, value.display, value.canonical ?? ''];
      })
      .join(' '),
  );
}

function parseTrackingRow(
  row: ExcelJS.Row,
  columns: Map<TrackingColumnKey, TrackingColumnInfo>,
  fileName: string,
  sheetName: string,
): TrackingRow | null {
  const division = valueFor(row, columns, 'division');
  const product = valueFor(row, columns, 'product');
  const hardwareVersion = valueFor(row, columns, 'hardwareVersion');
  const projectLead = valueFor(row, columns, 'projectLead');
  const manualUser = valueFor(row, columns, 'manualUser');
  const documentDetail = valueFor(row, columns, 'documentDetail');
  const { type: deliveryType, detail: deliveryTypeDetail } = detectDeliveryType(row, columns);
  const status = valueFor(row, columns, 'status');
  const areaPerson = valueFor(row, columns, 'areaPerson');
  const plannedPublicationDate = dateFor(row, columns, 'plannedPublicationDate');
  const plannedPublicationWeek = valueFor(row, columns, 'plannedPublicationWeek');
  const realPublicationDate = dateFor(row, columns, 'realPublicationDate');
  const realPublicationWeek = valueFor(row, columns, 'realPublicationWeek');
  const expectedReceptionDate = dateFor(row, columns, 'expectedReceptionDate');
  const expectedReceptionWeek = valueFor(row, columns, 'expectedReceptionWeek');
  const realReceptionDate = dateFor(row, columns, 'realReceptionDate');
  const realReceptionWeek = valueFor(row, columns, 'realReceptionWeek');
  const deadlineToMeetManualDate = dateFor(row, columns, 'deadlineToMeetManualDate');
  const manualDeliveryDeadline = dateFor(row, columns, 'manualDeliveryDeadline');
  const estimatedTime = valueFor(row, columns, 'estimatedTime');
  const dedicatedTime = valueFor(row, columns, 'dedicatedTime');
  const comments = valueFor(row, columns, 'comments');
  const notes = valueFor(row, columns, 'notes');
  const owner = chooseOwner(areaPerson, projectLead);

  if (!hasStructuredContent([division, product, hardwareVersion, manualUser, documentDetail, status, areaPerson])) {
    return null;
  }

  const keyValues = { product, hardwareVersion, manualUser, documentDetail, deliveryType };
  const dateState = getDateState({
    deliveryType,
    status,
    plannedPublicationDate,
    realPublicationDate,
    expectedReceptionDate,
    realReceptionDate,
    deadlineToMeetManualDate,
    manualDeliveryDeadline,
  });

  return {
    id: `${fileName}-${sheetName}-${row.number}`,
    rowNumber: row.number,
    division,
    product,
    hardwareVersion,
    projectLead,
    manualUser,
    documentDetail,
    deliveryType,
    deliveryTypeDetail,
    status,
    areaPerson,
    owner,
    ownerSource: ownerSource(areaPerson, projectLead),
    plannedPublicationDate,
    plannedPublicationWeek,
    realPublicationDate,
    realPublicationWeek,
    expectedReceptionDate,
    expectedReceptionWeek,
    realReceptionDate,
    realReceptionWeek,
    deadlineToMeetManualDate,
    manualDeliveryDeadline,
    estimatedTime,
    dedicatedTime,
    comments,
    notes,
    naturalKey: buildNaturalKey(keyValues),
    dateState,
    searchText: buildSearchText([
      division,
      product,
      hardwareVersion,
      projectLead,
      manualUser,
      documentDetail,
      deliveryType,
      deliveryTypeDetail,
      status,
      areaPerson,
      owner,
      plannedPublicationDate,
      realPublicationDate,
      expectedReceptionDate,
      realReceptionDate,
      deadlineToMeetManualDate,
      manualDeliveryDeadline,
      estimatedTime,
      dedicatedTime,
      comments,
      notes,
    ]),
  };
}

export function getPreferredTrackingSheetNames(workbook: ExcelJS.Workbook): string[] {
  return workbook.worksheets
    .filter((worksheet) => normalizeText(worksheet.name).includes(TRACKING_SHEET_NAME_HINT))
    .map((worksheet) => worksheet.name);
}

export function getSelectableTrackingSheetNames(workbook: ExcelJS.Workbook, allowFallbackSheets: boolean): string[] {
  const preferredNames = getPreferredTrackingSheetNames(workbook);
  if (preferredNames.length > 0) {
    return preferredNames;
  }

  return allowFallbackSheets ? workbook.worksheets.map((worksheet) => worksheet.name) : [];
}

export function parseTrackingWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  fileName: string,
  sourceKind: TrackingSourceKind,
): ParsedTrackingSheet {
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new ExcelReadError('No se ha podido abrir la hoja seleccionada.');
  }

  const headerRowNumber = findHeaderRowNumber(worksheet);
  const columnMap = buildColumnMap(worksheet, headerRowNumber);
  const rows = [];

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const parsedRow = parseTrackingRow(worksheet.getRow(rowNumber), columnMap, fileName, worksheet.name);
    if (parsedRow) {
      rows.push(parsedRow);
    }
  }

  return {
    fileName,
    sheetName: worksheet.name,
    sourceKind,
    headerRowNumber,
    columns: Array.from(columnMap.values()),
    rows,
  };
}

export async function readTrackingWorkbook(file: File): Promise<ParsedTrackingWorkbook> {
  ensureXlsxFile(file);

  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  return {
    fileName: file.name,
    workbook,
  };
}
