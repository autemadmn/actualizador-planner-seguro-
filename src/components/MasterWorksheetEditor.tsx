import { useEffect, useMemo, useState } from 'react';
import type ExcelJS from 'exceljs';
import type { MasterChangeCandidate, ParsedMasterWorkbook } from '../types/master';
import { columnNumberToLetter } from '../utils/columnDetection';
import {
  canonicalDateToExcelSerial,
  extractCanonicalDatesFromText,
  formatDateForSpain,
  normalizeExcelDateValue,
  toCanonicalDateOnly,
} from '../utils/dateUtils';
import { normalizeText } from '../utils/normalizeText';
import { cellDisplayText } from '../services/excelParser';

type Worksheet = ExcelJS.Worksheet;
type Cell = ExcelJS.Cell;

interface MasterWorksheetEditorProps {
  masterWorkbook: ParsedMasterWorkbook | null;
  selectedCandidate: MasterChangeCandidate | null;
  autoDateFilterRequest: number;
}

interface EditableColumn {
  index: number;
  letter: string;
  header: string;
  normalizedHeader: string;
  widthPx: number;
  isDateColumn: boolean;
}

interface EditableCell {
  rowNumber: number;
  columnIndex: number;
  address: string;
  displayValue: string;
  searchText: string;
  canonicalDates: string[];
}

interface EditableRow {
  rowNumber: number;
  cells: EditableCell[];
  searchText: string;
}

interface SheetModel {
  headerRowNumber: number;
  columns: EditableColumn[];
  rows: EditableRow[];
}

const MAX_HEADER_SCAN_ROWS = 40;
const MAX_RENDER_COLUMNS = 120;
const PREFERRED_SHEET_TEXT = 'seguimiento proyectos';

function isDateHeader(header: string): boolean {
  const value = normalizeText(header);
  return (
    value.includes('fecha') ||
    value.includes('inicio') ||
    value.includes('fin') ||
    value.includes('vencimiento') ||
    value.includes('prevista') ||
    value.includes('planificada') ||
    value.includes('recepcion')
  );
}

function dateValuesFromCell(cell: Cell, column: EditableColumn): string[] {
  const dates = new Set<string>();
  const directDate = normalizeExcelDateValue(cell.value, cell.text);

  if (directDate && (column.isDateColumn || cell.value instanceof Date)) {
    dates.add(directDate);
  }

  for (const date of extractCanonicalDatesFromText(cellDisplayText(cell))) {
    dates.add(date);
  }

  return Array.from(dates);
}

function displayValueForCell(cell: Cell, column: EditableColumn): string {
  const canonical = dateValuesFromCell(cell, column)[0];
  if (canonical && (column.isDateColumn || cell.value instanceof Date)) {
    return formatDateForSpain(canonical);
  }

  return cellDisplayText(cell);
}

function findUsedColumnCount(worksheet: Worksheet): number {
  let maxColumn = 1;

  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (_cell, columnNumber) => {
      maxColumn = Math.max(maxColumn, columnNumber);
    });
  });

  return Math.min(maxColumn, MAX_RENDER_COLUMNS);
}

function findHeaderRowNumber(worksheet: Worksheet, maxColumn: number): number {
  let bestRowNumber = 1;
  let bestScore = -1;
  const rowLimit = Math.min(worksheet.rowCount, MAX_HEADER_SCAN_ROWS);
  const headerHints = ['nombre', 'tarea', 'descripcion', 'proyecto', 'responsable', 'asignado', 'fecha', 'inicio', 'fin'];

  for (let rowNumber = 1; rowNumber <= rowLimit; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    let filledCount = 0;
    let hintScore = 0;

    for (let columnIndex = 1; columnIndex <= maxColumn; columnIndex += 1) {
      const text = cellDisplayText(row.getCell(columnIndex)).trim();
      if (!text) {
        continue;
      }

      filledCount += 1;
      const normalized = normalizeText(text);
      if (headerHints.some((hint) => normalized.includes(hint))) {
        hintScore += 4;
      }
    }

    const score = filledCount + hintScore;
    if (score > bestScore) {
      bestScore = score;
      bestRowNumber = rowNumber;
    }
  }

  return bestRowNumber;
}

function buildSheetModel(worksheet: Worksheet): SheetModel {
  const maxColumn = findUsedColumnCount(worksheet);
  const headerRowNumber = findHeaderRowNumber(worksheet, maxColumn);
  const headerRow = worksheet.getRow(headerRowNumber);
  const columns: EditableColumn[] = [];

  for (let columnIndex = 1; columnIndex <= maxColumn; columnIndex += 1) {
    const headerText = cellDisplayText(headerRow.getCell(columnIndex)).trim();
    const column = worksheet.getColumn(columnIndex);

    columns.push({
      index: columnIndex,
      letter: columnNumberToLetter(columnIndex),
      header: headerText || columnNumberToLetter(columnIndex),
      normalizedHeader: normalizeText(headerText),
      widthPx: Math.min(320, Math.max(110, Number(column.width ?? 14) * 8)),
      isDateColumn: isDateHeader(headerText),
    });
  }

  const rows: EditableRow[] = [];
  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const cells = columns.map((column) => {
      const cell = row.getCell(column.index);
      const displayValue = displayValueForCell(cell, column);
      const canonicalDates = dateValuesFromCell(cell, column);

      return {
        rowNumber,
        columnIndex: column.index,
        address: cell.address,
        displayValue,
        searchText: normalizeText([displayValue, ...canonicalDates, ...canonicalDates.map(formatDateForSpain)].join(' ')),
        canonicalDates,
      };
    });

    if (cells.some((cell) => cell.displayValue.trim())) {
      rows.push({
        rowNumber,
        cells,
        searchText: normalizeText(cells.map((cell) => cell.displayValue).join(' ')),
      });
    }
  }

  return { headerRowNumber, columns, rows };
}

function getSheetNames(masterWorkbook: ParsedMasterWorkbook | null): string[] {
  return masterWorkbook?.workbook.worksheets.map((worksheet) => worksheet.name) ?? [];
}

function getPreferredSheetNames(sheetNames: string[]): string[] {
  return sheetNames.filter((name) => normalizeText(name).includes(PREFERRED_SHEET_TEXT));
}

function parseEditableValue(value: string, column: EditableColumn): { value: ExcelJS.CellValue; numFmt?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }

  const canonicalDate = toCanonicalDateOnly(trimmed);
  if (canonicalDate) {
    return {
      value: canonicalDateToExcelSerial(canonicalDate),
      numFmt: 'dd/mm/yyyy',
    };
  }

  if (!column.isDateColumn && /^-?\d+(?:[.,]\d+)?$/.test(trimmed)) {
    return { value: Number(trimmed.replace(',', '.')) };
  }

  return { value };
}

export function MasterWorksheetEditor({
  masterWorkbook,
  selectedCandidate,
  autoDateFilterRequest,
}: MasterWorksheetEditorProps) {
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [editVersion, setEditVersion] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilterIndex, setColumnFilterIndex] = useState('all');
  const [columnFilterValue, setColumnFilterValue] = useState('');
  const [autoDateFilter, setAutoDateFilter] = useState<Set<string>>(new Set());
  const [autoFilterMessage, setAutoFilterMessage] = useState<string | null>(null);

  const sheetNames = useMemo(() => getSheetNames(masterWorkbook), [masterWorkbook]);
  const preferredSheetNames = useMemo(() => getPreferredSheetNames(sheetNames), [sheetNames]);
  const selectableSheetNames = preferredSheetNames.length > 0 ? preferredSheetNames : sheetNames;
  const needsManualSheetChoice = masterWorkbook !== null && preferredSheetNames.length === 0;
  const hasMultiplePreferredSheets = preferredSheetNames.length > 1;

  useEffect(() => {
    setSelectedSheetName((current) => {
      if (current && selectableSheetNames.includes(current)) {
        return current;
      }

      return selectableSheetNames[0] ?? '';
    });
  }, [selectableSheetNames]);

  useEffect(() => {
    if (autoDateFilterRequest === 0) {
      return;
    }

    const previousDates = selectedCandidate?.changes
      .map((change) => change.previous)
      .filter((date): date is string => Boolean(date)) ?? [];

    if (previousDates.length === 0) {
      setAutoDateFilter(new Set());
      setAutoFilterMessage('El cambio seleccionado no tiene fechas anteriores para buscar en el maestro.');
      return;
    }

    setAutoDateFilter(new Set(previousDates));
    setSearchTerm('');
    setColumnFilterIndex('all');
    setColumnFilterValue('');
    setAutoFilterMessage(null);
  }, [autoDateFilterRequest, selectedCandidate]);

  const worksheet = selectedSheetName ? masterWorkbook?.workbook.getWorksheet(selectedSheetName) : undefined;
  const model = useMemo(() => (worksheet ? buildSheetModel(worksheet) : null), [worksheet, editVersion]);
  const normalizedSearch = normalizeText(searchTerm);
  const normalizedColumnFilter = normalizeText(columnFilterValue);
  const selectedColumnIndex = columnFilterIndex === 'all' ? null : Number(columnFilterIndex);
  const hasAutoFilter = autoDateFilter.size > 0;

  const filteredRows = useMemo(() => {
    if (!model) {
      return [];
    }

    return model.rows.filter((row) => {
      const matchesSearch = !normalizedSearch || row.searchText.includes(normalizedSearch);
      const matchesColumn =
        !selectedColumnIndex ||
        !normalizedColumnFilter ||
        row.cells
          .find((cell) => cell.columnIndex === selectedColumnIndex)
          ?.searchText.includes(normalizedColumnFilter);
      const matchesAutoDate =
        !hasAutoFilter ||
        row.cells.some((cell) => cell.canonicalDates.some((date) => autoDateFilter.has(date)));

      return matchesSearch && matchesColumn && matchesAutoDate;
    });
  }, [autoDateFilter, hasAutoFilter, model, normalizedColumnFilter, normalizedSearch, selectedColumnIndex]);

  useEffect(() => {
    if (hasAutoFilter && filteredRows.length === 0) {
      setAutoFilterMessage(
        'No se han encontrado filas en Seguimiento Proyectos con las fechas anteriores de este cambio. Puedes buscar manualmente usando los filtros.',
      );
    } else if (hasAutoFilter) {
      setAutoFilterMessage(null);
    }
  }, [filteredRows.length, hasAutoFilter]);

  const clearFilters = (): void => {
    setSearchTerm('');
    setColumnFilterIndex('all');
    setColumnFilterValue('');
    setAutoDateFilter(new Set());
    setAutoFilterMessage(null);
  };

  const clearAutoFilter = (): void => {
    setAutoDateFilter(new Set());
    setAutoFilterMessage(null);
  };

  const commitCellValue = (cell: EditableCell, column: EditableColumn, nextValue: string): void => {
    if (!worksheet || nextValue === cell.displayValue) {
      return;
    }

    const targetCell = worksheet.getRow(cell.rowNumber).getCell(cell.columnIndex);
    const parsed = parseEditableValue(nextValue, column);
    targetCell.value = parsed.value;
    if (parsed.numFmt && !targetCell.numFmt) {
      targetCell.numFmt = parsed.numFmt;
    }

    setEditVersion((version) => version + 1);
  };

  if (!masterWorkbook) {
    return (
      <section className="master-workbook-panel">
        <h2>Excel maestro interno editable</h2>
        <p className="grid-message is-error">Carga el Excel maestro para editar la hoja interna.</p>
      </section>
    );
  }

  return (
    <section className="master-workbook-panel" aria-label="Excel maestro interno editable">
      <div className="master-section-heading">
        <div>
          <h2>Excel maestro interno editable</h2>
        </div>
        <div className="master-sheet-meta">
          <span>{filteredRows.length} filas visibles</span>
          {model && <span>Cabecera detectada en fila {model.headerRowNumber}</span>}
        </div>
      </div>

      {(needsManualSheetChoice || hasMultiplePreferredSheets) && (
        <p className={needsManualSheetChoice ? 'grid-message is-error' : 'grid-message is-success'}>
          {needsManualSheetChoice
            ? 'No se ha encontrado ninguna hoja del Excel maestro que contenga "Seguimiento Proyectos" en el nombre. Selecciona manualmente la hoja que quieres editar.'
            : 'Hay varias hojas que contienen "Seguimiento Proyectos". Selecciona cuál quieres editar.'}
        </p>
      )}

      <div className="master-sheet-toolbar">
        <label>
          <span>Hoja</span>
          <select value={selectedSheetName} onChange={(event) => setSelectedSheetName(event.currentTarget.value)}>
            {selectableSheetNames.map((sheetName) => (
              <option key={sheetName} value={sheetName}>
                {sheetName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid-search">
          <span>Buscar en Seguimiento Proyectos</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.currentTarget.value)}
            placeholder="Buscar texto en toda la hoja"
          />
        </label>
        <label>
          <span>Filtrar por columna</span>
          <select value={columnFilterIndex} onChange={(event) => setColumnFilterIndex(event.currentTarget.value)}>
            <option value="all">Todas</option>
            {model?.columns.map((column) => (
              <option key={column.index} value={column.index}>
                {column.letter} · {column.header}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Valor</span>
          <input
            value={columnFilterValue}
            onChange={(event) => setColumnFilterValue(event.currentTarget.value)}
            placeholder="Valor a localizar"
          />
        </label>
        <button className="secondary-button grid-clear-button" type="button" onClick={clearFilters}>
          Limpiar filtros
        </button>
      </div>

      {hasAutoFilter && (
        <div className="master-auto-filter-strip">
          <span>
            Filtro automático por fechas anteriores:{' '}
            {Array.from(autoDateFilter)
              .map((date) => formatDateForSpain(date))
              .join(', ')}
          </span>
          <button className="secondary-button" type="button" onClick={clearAutoFilter}>
            Quitar filtro automático
          </button>
        </div>
      )}

      {autoFilterMessage && <p className="grid-message is-error">{autoFilterMessage}</p>}

      <div className="master-edit-table-shell">
        <table className="master-edit-table">
          <thead>
            <tr>
              <th className="master-row-number">Fila</th>
              {model?.columns.map((column) => (
                <th key={column.index} style={{ minWidth: column.widthPx }}>
                  <span>{column.header}</span>
                  <small>{column.letter}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!model || filteredRows.length === 0 ? (
              <tr>
                <td colSpan={(model?.columns.length ?? 0) + 1} className="grid-empty-row">
                  No hay filas para mostrar con los filtros actuales.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.rowNumber}>
                  <td className="master-row-number">{row.rowNumber}</td>
                  {row.cells.map((cell) => {
                    const column = model.columns.find((candidate) => candidate.index === cell.columnIndex);

                    if (!column) {
                      return null;
                    }

                    const isHighlighted =
                      hasAutoFilter && cell.canonicalDates.some((date) => autoDateFilter.has(date));

                    return (
                      <td
                        key={cell.address}
                        className={isHighlighted ? 'master-date-match-cell' : undefined}
                        style={{ minWidth: column.widthPx }}
                      >
                        <input
                          key={`${cell.address}-${editVersion}`}
                          defaultValue={cell.displayValue}
                          onBlur={(event) => commitCellValue(cell, column, event.currentTarget.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur();
                            }

                            if (event.key === 'Escape') {
                              event.currentTarget.value = cell.displayValue;
                              event.currentTarget.blur();
                            }
                          }}
                          aria-label={`Celda ${cell.address}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
