import ExcelJS from 'exceljs';
import type { ComparedRow } from '../types/comparison';
import type {
  MasterChangeCandidate,
  MasterFieldChange,
  MasterProjectCandidate,
  MasterProjectValidation,
  MasterRow,
  MasterSheetColumns,
  ParsedMasterWorkbook,
} from '../types/master';
import { canonicalDateToExcelSerial, normalizeExcelDateValue } from '../utils/dateUtils';
import { normalizeText } from '../utils/normalizeText';
import { cellDisplayText } from './excelParser';
import { ExcelReadError } from './excelReader';

type Worksheet = ExcelJS.Worksheet;

const MAX_SCAN_ROWS = 120;
const MAX_SCAN_COLUMNS = 80;

function ensureXlsxFile(file: File): void {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new ExcelReadError('El archivo seleccionado no es un archivo .xlsx válido.');
  }
}

function isDateHeader(header: string): boolean {
  const value = normalizeText(header);
  return (
    value.includes('fecha') ||
    value.includes('inicio') ||
    value.includes('finalizacion') ||
    value.includes('fin') ||
    value.includes('vencimiento') ||
    value.includes('recepcion')
  );
}

function findHeaderRow(worksheet: Worksheet): MasterSheetColumns | null {
  const rowLimit = Math.min(worksheet.rowCount, MAX_SCAN_ROWS);

  for (let rowNumber = 1; rowNumber <= rowLimit; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const columnLimit = Math.min(Math.max(row.cellCount, row.actualCellCount), MAX_SCAN_COLUMNS);
    const headers = new Map<number, string>();

    for (let columnIndex = 1; columnIndex <= columnLimit; columnIndex += 1) {
      const header = cellDisplayText(row.getCell(columnIndex)).trim();
      if (header) {
        headers.set(columnIndex, header);
      }
    }

    const preferredName = headers.get(3);
    const detectedNameColumn =
      preferredName && normalizeText(preferredName) === 'nombre'
        ? 3
        : Array.from(headers.entries()).find(([, header]) => normalizeText(header) === 'nombre')?.[0];

    if (!detectedNameColumn) {
      continue;
    }

    const columns = Array.from(headers.entries()).map(([index, header]) => ({
      index,
      header,
      normalizedHeader: normalizeText(header),
    }));

    const findColumn = (patterns: string[]): number | null => {
      return (
        columns.find((column) =>
          patterns.some((pattern) => column.normalizedHeader.includes(pattern)),
        )?.index ?? null
      );
    };

    const dateColumns = columns.filter((column) => isDateHeader(column.header));

    return {
      headerRowNumber: rowNumber,
      nameColumnIndex: detectedNameColumn,
      assigneeColumnIndex: findColumn(['asignado', 'responsable']),
      statusColumnIndex: findColumn(['estado', 'status', 'completado']),
      observationsColumnIndex: findColumn(['observacion', 'comentario', 'notas']),
      startDateColumnIndex: findColumn(['inicio', 'prevista', 'planificada']),
      endDateColumnIndex:
        findColumn(['finalizacion', 'vencimiento', 'fecha real', 'recepcion', 'fin']) ??
        dateColumns[0]?.index ??
        null,
      dateColumns,
    };
  }

  return null;
}

function parseRowsFromWorksheet(worksheet: Worksheet, columns: MasterSheetColumns): MasterRow[] {
  const rows: MasterRow[] = [];

  for (let rowNumber = columns.headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const taskName = cellDisplayText(row.getCell(columns.nameColumnIndex)).trim();
    if (!taskName) {
      continue;
    }

    rows.push({
      worksheetName: worksheet.name,
      rowNumber,
      taskName,
      normalizedTaskName: normalizeText(taskName),
      assignee: columns.assigneeColumnIndex
        ? cellDisplayText(row.getCell(columns.assigneeColumnIndex)).trim()
        : '',
      status: columns.statusColumnIndex ? cellDisplayText(row.getCell(columns.statusColumnIndex)).trim() : '',
      observations: columns.observationsColumnIndex
        ? cellDisplayText(row.getCell(columns.observationsColumnIndex)).trim()
        : '',
      columns,
    });
  }

  return rows;
}

function collectProjectCandidates(workbook: ExcelJS.Workbook): MasterProjectCandidate[] {
  const candidates: MasterProjectCandidate[] = [];

  for (const worksheet of workbook.worksheets) {
    candidates.push({
      worksheetName: worksheet.name,
      cellAddress: 'sheet',
      value: worksheet.name,
      normalizedValue: normalizeText(worksheet.name),
      source: 'sheet',
    });

    const rowLimit = Math.min(worksheet.rowCount, MAX_SCAN_ROWS);
    for (let rowNumber = 1; rowNumber <= rowLimit; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const columnLimit = Math.min(Math.max(row.cellCount, row.actualCellCount), MAX_SCAN_COLUMNS);

      for (let columnIndex = 1; columnIndex <= columnLimit; columnIndex += 1) {
        const cell = row.getCell(columnIndex);
        const value = cellDisplayText(cell).trim();
        if (!value) {
          continue;
        }

        candidates.push({
          worksheetName: worksheet.name,
          cellAddress: cell.address,
          value,
          normalizedValue: normalizeText(value),
          source: 'cell',
        });
      }
    }
  }

  return candidates;
}

export async function readMasterExcel(file: File): Promise<ParsedMasterWorkbook> {
  ensureXlsxFile(file);

  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const rows = workbook.worksheets.flatMap((worksheet) => {
    const columns = findHeaderRow(worksheet);
    return columns ? parseRowsFromWorksheet(worksheet, columns) : [];
  });

  return {
    fileName: file.name,
    workbook,
    rows,
    projectCandidates: collectProjectCandidates(workbook),
  };
}

export function validateMasterProject(
  masterWorkbook: ParsedMasterWorkbook | null,
  projectName: string,
): MasterProjectValidation {
  const normalizedProjectName = normalizeText(projectName);

  if (!normalizedProjectName) {
    return {
      status: 'missing_project',
      projectName,
      normalizedProjectName,
      worksheetName: null,
      message: 'No se puede leer el nombre del proyecto en la celda B1 del Excel de Planner.',
    };
  }

  if (!masterWorkbook) {
    return {
      status: 'not_found',
      projectName,
      normalizedProjectName,
      worksheetName: null,
      message: 'No se ha cargado ningún Excel maestro.',
    };
  }

  const exactMatches = masterWorkbook.projectCandidates.filter(
    (candidate) => candidate.normalizedValue === normalizedProjectName,
  );
  const worksheetNames = Array.from(new Set(exactMatches.map((candidate) => candidate.worksheetName)));

  if (worksheetNames.length === 1) {
    return {
      status: 'valid',
      projectName,
      normalizedProjectName,
      worksheetName: worksheetNames[0],
      message: `Proyecto validado: ${projectName}`,
    };
  }

  if (worksheetNames.length > 1) {
    return {
      status: 'ambiguous',
      projectName,
      normalizedProjectName,
      worksheetName: null,
      message: `Proyecto detectado: ${projectName}. Hay varias coincidencias posibles en el Excel maestro.`,
    };
  }

  return {
    status: 'not_found',
    projectName,
    normalizedProjectName,
    worksheetName: null,
    message: `Proyecto detectado: ${projectName}. No se ha encontrado una coincidencia segura en el Excel maestro.`,
  };
}

function getDateFromMasterRow(masterWorkbook: ParsedMasterWorkbook, row: MasterRow, columnIndex: number): string | null {
  const worksheet = masterWorkbook.workbook.getWorksheet(row.worksheetName);
  if (!worksheet) {
    return null;
  }

  const cell = worksheet.getRow(row.rowNumber).getCell(columnIndex);
  return normalizeExcelDateValue(cell.value, cell.text);
}

function candidateId(row: ComparedRow, index: number): string {
  return `${row.currentRow.excelRowNumber}-${row.currentRow.normalizedTaskName}-${index}`;
}

function compareDateField(
  masterWorkbook: ParsedMasterWorkbook,
  masterRow: MasterRow,
  plannerValue: string | null,
  columnIndex: number | null,
  label: string,
  field: MasterFieldChange['field'],
): MasterFieldChange | null {
  if (!columnIndex) {
    return null;
  }

  const previous = getDateFromMasterRow(masterWorkbook, masterRow, columnIndex);
  if (previous === plannerValue) {
    return null;
  }

  return {
    field,
    label,
    masterColumnIndex: columnIndex,
    previous,
    current: plannerValue,
  };
}

export function buildMasterChangeCandidates(
  masterWorkbook: ParsedMasterWorkbook | null,
  plannerRows: ComparedRow[],
  projectName: string,
): MasterChangeCandidate[] {
  const validation = validateMasterProject(masterWorkbook, projectName);

  if (!masterWorkbook || validation.status !== 'valid') {
    return plannerRows.map((row, index) => ({
      id: candidateId(row, index),
      comparedRow: row,
      masterRow: null,
      projectName,
      validation,
      status: 'project_blocked',
      changes: [],
      observation: validation.message,
    }));
  }

  const scopedMasterRows = masterWorkbook.rows.filter(
    (row) => !validation.worksheetName || row.worksheetName === validation.worksheetName,
  );
  const rowsByName = new Map<string, MasterRow[]>();

  for (const row of scopedMasterRows) {
    const group = rowsByName.get(row.normalizedTaskName) ?? [];
    group.push(row);
    rowsByName.set(row.normalizedTaskName, group);
  }

  return plannerRows.map((row, index) => {
    const masterMatches = rowsByName.get(row.currentRow.normalizedTaskName) ?? [];

    if (masterMatches.length === 0) {
      return {
        id: candidateId(row, index),
        comparedRow: row,
        masterRow: null,
        projectName,
        validation,
        status: 'not_found',
        changes: [],
        observation: 'No se ha encontrado una fila segura en el Excel maestro para este nombre.',
      };
    }

    if (masterMatches.length > 1) {
      return {
        id: candidateId(row, index),
        comparedRow: row,
        masterRow: null,
        projectName,
        validation,
        status: 'ambiguous',
        changes: [],
        observation: 'Hay varias filas con el mismo nombre en el Excel maestro. No se aplicará automáticamente.',
      };
    }

    const masterRow = masterMatches[0];

    if (!masterRow.columns.startDateColumnIndex && !masterRow.columns.endDateColumnIndex) {
      return {
        id: candidateId(row, index),
        comparedRow: row,
        masterRow,
        projectName,
        validation,
        status: 'blocked',
        changes: [],
        observation: 'No se ha localizado una columna de fecha destino clara en el Excel maestro.',
      };
    }

    const changes = [
      compareDateField(
        masterWorkbook,
        masterRow,
        row.currentRow.startDate,
        masterRow.columns.startDateColumnIndex,
        'Inicio',
        'startDate',
      ),
      compareDateField(
        masterWorkbook,
        masterRow,
        row.currentRow.endDate,
        masterRow.columns.endDateColumnIndex,
        'Finalización',
        'endDate',
      ),
    ].filter((change): change is MasterFieldChange => Boolean(change));

    if (changes.length === 0) {
      return {
        id: candidateId(row, index),
        comparedRow: row,
        masterRow,
        projectName,
        validation,
        status: 'no_change',
        changes,
        observation: 'Sin cambios de fecha respecto al Excel maestro.',
      };
    }

    return {
      id: candidateId(row, index),
      comparedRow: row,
      masterRow,
      projectName,
      validation,
      status: 'ready',
      changes,
      observation: 'Cambio listo para aplicar.',
    };
  });
}

export async function applyMasterChanges(
  masterWorkbook: ParsedMasterWorkbook,
  candidates: MasterChangeCandidate[],
): Promise<Blob> {
  for (const candidate of candidates) {
    if (candidate.status !== 'ready' || !candidate.masterRow) {
      continue;
    }

    const worksheet = masterWorkbook.workbook.getWorksheet(candidate.masterRow.worksheetName);
    if (!worksheet) {
      continue;
    }

    const row = worksheet.getRow(candidate.masterRow.rowNumber);
    for (const change of candidate.changes) {
      const targetCell = row.getCell(change.masterColumnIndex);
      const serialDate = canonicalDateToExcelSerial(change.current);

      targetCell.value = serialDate;
      if (serialDate !== null && !targetCell.numFmt) {
        targetCell.numFmt = 'dd/mm/yyyy';
      }
    }
  }

  const buffer = await masterWorkbook.workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
