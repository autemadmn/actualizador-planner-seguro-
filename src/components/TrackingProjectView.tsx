import { useEffect, useMemo, useState } from 'react';
import type { ComparedRow } from '../types/comparison';
import type { ParsedMasterWorkbook } from '../types/master';
import type {
  ParsedTrackingSheet,
  ParsedTrackingWorkbook,
  TrackingDateState,
  TrackingDeliveryType,
  TrackingRow,
  TrackingSourceKind,
} from '../types/tracking';
import { getTrackingComparisonColumns, rowsFromTrackingSheet } from '../services/trackingComparisonView';
import { getInitials } from '../utils/plannerData';
import { normalizeText } from '../utils/normalizeText';
import {
  getPreferredTrackingSheetNames,
  getSelectableTrackingSheetNames,
  parseTrackingWorksheet,
  readTrackingWorkbook,
} from '../services/trackingSheet';
import { CalendarView } from './CalendarView';
import { ComparisonTable } from './ComparisonTable';

interface TrackingProjectViewProps {
  masterWorkbook: ParsedMasterWorkbook | null;
  viewMode: TrackingViewMode;
  onViewModeChange: (mode: TrackingViewMode) => void;
}

export type TrackingViewMode = 'excel' | 'planner' | 'grid' | 'calendar';

interface TrackingFilters {
  search: string;
  division: string;
  product: string;
  hardware: string;
  manual: string;
  deliveryType: string;
  owner: string;
  status: string;
  dateState: 'all' | TrackingDateState;
}

interface SourceOption {
  kind: TrackingSourceKind;
  label: string;
  workbook: ParsedTrackingWorkbook;
  allowFallbackSheets: boolean;
  hasPreferredSheet: boolean;
}

const initialFilters: TrackingFilters = {
  search: '',
  division: 'all',
  product: 'all',
  hardware: 'all',
  manual: 'all',
  deliveryType: 'all',
  owner: 'all',
  status: 'all',
  dateState: 'all',
};

const emptyTrackingRows: TrackingRow[] = [];

const trackingViewTabs: Array<{ mode: TrackingViewMode; label: string; icon: string }> = [
  { mode: 'excel', label: 'Excel', icon: 'XL' },
  { mode: 'planner', label: 'Planner', icon: 'PL' },
  { mode: 'grid', label: 'Grid', icon: 'GR' },
  { mode: 'calendar', label: 'Calendario', icon: 'CA' },
];

const trackingViewCopy: Record<TrackingViewMode, { title: string; description: string }> = {
  excel: {
    title: 'Excel Seguimiento de Proyectos',
    description: 'Tabla filtrable de la hoja operativa del Excel maestro.',
  },
  planner: {
    title: 'Planner Seguimiento de Proyectos',
    description: 'Tablero de entregables de Seguimiento usando solo sus filas y requisitos filtrados.',
  },
  grid: {
    title: 'Grid Seguimiento de Proyectos',
    description: 'Revision en formato grid de los registros de Seguimiento, separada de la comparacion Planner.',
  },
  calendar: {
    title: 'Calendario Seguimiento de Proyectos',
    description: 'Calendario de publicaciones, recepciones y deadlines de la hoja Seguimiento Proyectos.',
  },
};

const deliveryTypeLabels: Record<TrackingDeliveryType, string> = {
  I: 'Input',
  M: 'Manual',
  'M-T': 'Manual traducido',
  O: 'Output',
  'Sin tipo': 'Sin tipo',
};

const dateStateLabels: Record<TrackingDateState, string> = {
  completed: 'Completado',
  overdue: 'Vencido',
  planned: 'Planificado',
  tbd: 'TBD',
  unknown: 'Sin fecha',
};

const trackingKanbanColumns: Array<{ state: TrackingDateState; title: string; description: string }> = [
  { state: 'overdue', title: 'Vencidas', description: 'Fechas que ya piden accion.' },
  { state: 'planned', title: 'Planificadas', description: 'Entregables con fecha prevista.' },
  { state: 'tbd', title: 'TBD', description: 'Pendientes de fecha o decision.' },
  { state: 'completed', title: 'Completadas', description: 'Tareas cerradas o con fecha real.' },
  { state: 'unknown', title: 'Sin fecha', description: 'Sin referencia temporal util.' },
];

function errorMessageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : 'No se ha podido leer el archivo seleccionado.';
}

function emptyDateDisplay(value: string): string {
  return value || '-';
}

function dateDisplay(value: { display: string }): string {
  return value.display || '-';
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, 'es'));
}

function splitProductLabels(product: string): string[] {
  return product
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function optionValues(rows: TrackingRow[], getter: (row: TrackingRow) => string | string[]): string[] {
  return uniqueSorted(
    rows.flatMap((row) => {
      const value = getter(row);
      return Array.isArray(value) ? value : [value];
    }),
  );
}

function rowMatchesProduct(row: TrackingRow, selectedProduct: string): boolean {
  if (selectedProduct === 'all') {
    return true;
  }

  const normalizedSelected = normalizeText(selectedProduct);
  return splitProductLabels(row.product).some((product) => normalizeText(product) === normalizedSelected);
}

function rowMatchesFilters(row: TrackingRow, filters: TrackingFilters): boolean {
  const normalizedSearch = normalizeText(filters.search);
  const matchesSearch = !normalizedSearch || row.searchText.includes(normalizedSearch);
  const matchesDivision = filters.division === 'all' || row.division === filters.division;
  const matchesProduct = rowMatchesProduct(row, filters.product);
  const matchesHardware = filters.hardware === 'all' || row.hardwareVersion === filters.hardware;
  const matchesManual = filters.manual === 'all' || row.manualUser === filters.manual;
  const matchesType = filters.deliveryType === 'all' || row.deliveryType === filters.deliveryType;
  const matchesOwner = filters.owner === 'all' || row.owner === filters.owner;
  const matchesStatus = filters.status === 'all' || row.status === filters.status;
  const matchesDateState = filters.dateState === 'all' || row.dateState === filters.dateState;

  return (
    matchesSearch &&
    matchesDivision &&
    matchesProduct &&
    matchesHardware &&
    matchesManual &&
    matchesType &&
    matchesOwner &&
    matchesStatus &&
    matchesDateState
  );
}

function buildSourceOptions(
  masterWorkbook: ParsedMasterWorkbook | null,
  directWorkbook: ParsedTrackingWorkbook | null,
): SourceOption[] {
  const options: SourceOption[] = [];

  if (masterWorkbook) {
    const masterTrackingWorkbook: ParsedTrackingWorkbook = {
      fileName: masterWorkbook.fileName,
      workbook: masterWorkbook.workbook,
    };
    const hasPreferredSheet = getPreferredTrackingSheetNames(masterWorkbook.workbook).length > 0;

    if (hasPreferredSheet) {
      options.push({
        kind: 'master',
        label: 'Excel maestro cargado',
        workbook: masterTrackingWorkbook,
        allowFallbackSheets: false,
        hasPreferredSheet,
      });
    }
  }

  if (directWorkbook) {
    options.push({
      kind: 'direct',
      label: 'Hoja subida directamente',
      workbook: directWorkbook,
      allowFallbackSheets: true,
      hasPreferredSheet: getPreferredTrackingSheetNames(directWorkbook.workbook).length > 0,
    });
  }

  return options;
}

function parseActiveSheet(
  source: SourceOption | null,
  selectedSheetName: string,
): { sheet: ParsedTrackingSheet | null; error: string | null } {
  if (!source || !selectedSheetName) {
    return { sheet: null, error: null };
  }

  try {
    return {
      sheet: parseTrackingWorksheet(source.workbook.workbook, selectedSheetName, source.workbook.fileName, source.kind),
      error: null,
    };
  } catch (error) {
    return {
      sheet: null,
      error: errorMessageFromUnknown(error),
    };
  }
}

function stateClass(state: TrackingDateState): string {
  if (state === 'completed') {
    return 'is-completed';
  }

  if (state === 'overdue') {
    return 'is-overdue';
  }

  if (state === 'tbd') {
    return 'is-tbd';
  }

  if (state === 'unknown') {
    return 'is-unknown';
  }

  return 'is-planned';
}

function sourceLabel(kind: TrackingSourceKind): string {
  return kind === 'master' ? 'Excel maestro' : 'Archivo directo';
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="tracking-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        <option value="all">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TrackingViewTabs({
  activeMode,
  onChange,
}: {
  activeMode: TrackingViewMode;
  onChange: (mode: TrackingViewMode) => void;
}) {
  return (
    <nav className="tracking-view-tabs" aria-label="Visualizaciones de Seguimiento">
      {trackingViewTabs.map((tab) => (
        <button
          key={tab.mode}
          type="button"
          className={activeMode === tab.mode ? 'is-active' : undefined}
          onClick={() => onChange(tab.mode)}
        >
          <span aria-hidden="true">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function TrackingDetail({ row }: { row: TrackingRow | null }) {
  if (!row) {
    return (
      <aside className="tracking-detail-panel">
        <h3>Detalle</h3>
        <p className="grid-muted">Selecciona una fila para ver comentarios, notas y fechas completas.</p>
      </aside>
    );
  }

  return (
    <aside className="tracking-detail-panel">
      <div className="tracking-detail-title">
        <span>Fila {row.rowNumber}</span>
        <h3>{row.documentDetail || row.manualUser || row.product}</h3>
      </div>
      <dl>
        <div>
          <dt>Clave natural</dt>
          <dd>
            {row.product} | {row.hardwareVersion} | {row.manualUser} | {row.deliveryType}
          </dd>
        </div>
        <div>
          <dt>Persona asignada</dt>
          <dd>{row.areaPerson || '-'}</dd>
        </div>
        <div>
          <dt>Maximo responsable</dt>
          <dd>{row.projectLead || '-'}</dd>
        </div>
        <div>
          <dt>Publicacion planificada / real</dt>
          <dd>
            {dateDisplay(row.plannedPublicationDate)} / {dateDisplay(row.realPublicationDate)}
          </dd>
        </div>
        <div>
          <dt>Recepcion prevista / real</dt>
          <dd>
            {dateDisplay(row.expectedReceptionDate)} / {dateDisplay(row.realReceptionDate)}
          </dd>
        </div>
        <div>
          <dt>Deadline manual</dt>
          <dd>{dateDisplay(row.manualDeliveryDeadline)}</dd>
        </div>
        <div>
          <dt>Comentarios/Faltantes</dt>
          <dd className="tracking-long-text">{row.comments || '-'}</dd>
        </div>
        <div>
          <dt>Notas</dt>
          <dd className="tracking-long-text">{row.notes || '-'}</dd>
        </div>
      </dl>
    </aside>
  );
}

function DetailField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'is-wide' : undefined}>
      <dt>{label}</dt>
      <dd>{value || '-'}</dd>
    </div>
  );
}

function formatDateWithWeek(value: { display: string }, week: string): string {
  const display = dateDisplay(value);
  return week ? `${display} - ${week}` : display;
}

function TrackingFullDetailModal({ row, onClose }: { row: TrackingRow; onClose: () => void }) {
  const title = row.documentDetail || row.manualUser || row.product || `Fila ${row.rowNumber}`;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="tracking-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tracking-detail-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="modal-kicker">Seguimiento Proyectos - Fila {row.rowNumber}</p>
            <h2 id="tracking-detail-modal-title">{title}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar detalle" onClick={onClose}>
            x
          </button>
        </header>

        <div className="tracking-detail-modal-status">
          <span className="tracking-type-pill">{deliveryTypeLabels[row.deliveryType]}</span>
          <span className={`tracking-state-pill ${stateClass(row.dateState)}`}>
            {row.status || dateStateLabels[row.dateState]}
          </span>
          <span>{row.owner || 'Sin responsable'}</span>
        </div>

        <dl className="tracking-detail-modal-grid">
          <DetailField label="Division" value={row.division} />
          <DetailField label="Producto" value={row.product} />
          <DetailField label="Version HW" value={row.hardwareVersion} />
          <DetailField label="Manual usuario" value={row.manualUser} />
          <DetailField label="Detalle documento" value={row.documentDetail} wide />
          <DetailField label="Tipo detalle" value={row.deliveryTypeDetail} />
          <DetailField label="Persona asignada" value={row.areaPerson} />
          <DetailField label="Responsable mostrado" value={row.owner} />
          <DetailField label="Maximo responsable" value={row.projectLead} />
          <DetailField label="Publicacion planificada" value={formatDateWithWeek(row.plannedPublicationDate, row.plannedPublicationWeek)} />
          <DetailField label="Publicacion real" value={formatDateWithWeek(row.realPublicationDate, row.realPublicationWeek)} />
          <DetailField label="Recepcion prevista" value={formatDateWithWeek(row.expectedReceptionDate, row.expectedReceptionWeek)} />
          <DetailField label="Recepcion real" value={formatDateWithWeek(row.realReceptionDate, row.realReceptionWeek)} />
          <DetailField label="Deadline para cumplir manual" value={dateDisplay(row.deadlineToMeetManualDate)} />
          <DetailField label="Deadline entrega manual" value={dateDisplay(row.manualDeliveryDeadline)} />
          <DetailField label="Tiempo estimado neto" value={row.estimatedTime} />
          <DetailField label="Tiempo dedicado neto" value={row.dedicatedTime} />
          <DetailField label="Clave natural" value={row.naturalKey} wide />
          <DetailField label="Comentarios/Faltantes" value={row.comments} wide />
          <DetailField label="Notas" value={row.notes} wide />
        </dl>
      </section>
    </div>
  );
}

export function TrackingProjectView({ masterWorkbook, viewMode, onViewModeChange }: TrackingProjectViewProps) {
  const [directWorkbook, setDirectWorkbook] = useState<ParsedTrackingWorkbook | null>(null);
  const [directError, setDirectError] = useState<string | null>(null);
  const [isDirectProcessing, setIsDirectProcessing] = useState(false);
  const [sourceKind, setSourceKind] = useState<TrackingSourceKind | ''>('');
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<TrackingRow | null>(null);

  const sourceOptions = useMemo(() => buildSourceOptions(masterWorkbook, directWorkbook), [directWorkbook, masterWorkbook]);
  const activeSource = sourceOptions.find((source) => source.kind === sourceKind) ?? null;
  const sheetNames = useMemo(
    () => (activeSource ? getSelectableTrackingSheetNames(activeSource.workbook.workbook, activeSource.allowFallbackSheets) : []),
    [activeSource],
  );
  const parsedResult = useMemo(() => parseActiveSheet(activeSource, selectedSheetName), [activeSource, selectedSheetName]);
  const parsedSheet = parsedResult.sheet;
  const rows = parsedSheet?.rows ?? emptyTrackingRows;
  const filteredRows = useMemo(() => rows.filter((row) => rowMatchesFilters(row, filters)), [filters, rows]);
  const selectedRow = useMemo(
    () => filteredRows.find((row) => row.id === selectedRowId) ?? rows.find((row) => row.id === selectedRowId) ?? null,
    [filteredRows, rows, selectedRowId],
  );
  const trackingComparisonRows = useMemo(() => rowsFromTrackingSheet(filteredRows), [filteredRows]);
  const trackingComparisonColumns = useMemo(() => getTrackingComparisonColumns(), []);
  const trackingRowsByRowNumber = useMemo(
    () => new Map(filteredRows.map((row) => [row.rowNumber, row])),
    [filteredRows],
  );
  const viewCopy = trackingViewCopy[viewMode];
  const masterHasTrackingSheet = masterWorkbook
    ? getPreferredTrackingSheetNames(masterWorkbook.workbook).length > 0
    : false;

  useEffect(() => {
    setSourceKind((current) => {
      if (current && sourceOptions.some((source) => source.kind === current)) {
        return current;
      }

      return sourceOptions[0]?.kind ?? '';
    });
  }, [sourceOptions]);

  useEffect(() => {
    setSelectedSheetName((current) => {
      if (current && sheetNames.includes(current)) {
        return current;
      }

      return sheetNames[0] ?? '';
    });
  }, [sheetNames]);

  useEffect(() => {
    setSelectedRowId((current) => {
      if (current && filteredRows.some((row) => row.id === current)) {
        return current;
      }

      return filteredRows[0]?.id ?? null;
    });
  }, [filteredRows]);

  const metrics = useMemo(
    () => ({
      total: rows.length,
      visible: filteredRows.length,
      completed: rows.filter((row) => row.dateState === 'completed').length,
      overdue: rows.filter((row) => row.dateState === 'overdue').length,
      tbd: rows.filter((row) => row.dateState === 'tbd').length,
    }),
    [filteredRows.length, rows],
  );

  const filterOptions = useMemo(
    () => ({
      divisions: optionValues(rows, (row) => row.division),
      products: optionValues(rows, (row) => splitProductLabels(row.product)),
      hardware: optionValues(rows, (row) => row.hardwareVersion),
      manuals: optionValues(rows, (row) => row.manualUser),
      deliveryTypes: optionValues(rows, (row) => row.deliveryType),
      owners: optionValues(rows, (row) => row.owner),
      statuses: optionValues(rows, (row) => row.status),
    }),
    [rows],
  );

  const handleDirectFileSelected = async (file: File): Promise<void> => {
    setDirectError(null);
    setIsDirectProcessing(true);

    try {
      const workbook = await readTrackingWorkbook(file);
      setDirectWorkbook(workbook);
      setSourceKind('direct');
      setFilters(initialFilters);
    } catch (error) {
      setDirectError(errorMessageFromUnknown(error));
    } finally {
      setIsDirectProcessing(false);
    }
  };

  const clearFilters = (): void => {
    setFilters(initialFilters);
  };

  const openRowDetail = (row: TrackingRow): void => {
    setSelectedRowId(row.id);
    setDetailRow(row);
  };

  const openComparedRowDetail = (row: ComparedRow): void => {
    const trackingRow = trackingRowsByRowNumber.get(row.currentRow.excelRowNumber);
    if (trackingRow) {
      openRowDetail(trackingRow);
    }
  };

  const renderTrackingKanban = () => {
    if (filteredRows.length === 0) {
      return <div className="planner-empty">No hay tarjetas de Seguimiento para los filtros seleccionados.</div>;
    }

    return (
      <section className="tracking-kanban" aria-label="Planner Seguimiento de Proyectos">
        {trackingKanbanColumns.map((column) => {
          const columnRows = filteredRows.filter((row) => row.dateState === column.state);

          return (
            <section className="tracking-kanban-column" key={column.state}>
              <header>
                <div>
                  <h3>{column.title}</h3>
                  <p>{column.description}</p>
                </div>
                <strong>{columnRows.length}</strong>
              </header>

              <div className="tracking-kanban-list">
                {columnRows.length === 0 ? (
                  <span className="tracking-kanban-empty">Sin entregables</span>
                ) : (
                  columnRows.map((row) => (
                    <button
                      className={`tracking-kanban-card ${stateClass(row.dateState)}`}
                      key={row.id}
                      type="button"
                      onClick={() => openRowDetail(row)}
                    >
                      <span className="tracking-kanban-card-title">
                        {row.documentDetail || row.manualUser || row.product || `Fila ${row.rowNumber}`}
                      </span>
                      <span className="tracking-kanban-card-subtitle">
                        {row.product || 'Sin producto'}{row.hardwareVersion ? ` - ${row.hardwareVersion}` : ''}
                      </span>
                      <span className="tracking-kanban-card-meta">
                        <span className="tracking-type-pill">{deliveryTypeLabels[row.deliveryType]}</span>
                        <span>{dateDisplay(row.manualDeliveryDeadline)}</span>
                      </span>
                      <span className="tracking-kanban-card-footer">
                        <span className="grid-avatar" aria-hidden="true">{getInitials(row.owner)}</span>
                        <span>{row.owner || 'Sin responsable'}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </section>
    );
  };

  const renderExcelView = () => (
    <div className="tracking-content-grid">
      <div className="tracking-table-shell">
        <table className="tracking-table">
          <thead>
            <tr>
              <th>Fila</th>
              <th>Division</th>
              <th>Producto</th>
              <th>Version HW</th>
              <th>Manual usuario</th>
              <th>Tipo</th>
              <th>Detalle documento</th>
              <th>Responsable</th>
              <th>Estado</th>
              <th>Plan pub.</th>
              <th>Real pub.</th>
              <th>Prev. recepcion</th>
              <th>Real recepcion</th>
              <th>Deadline manual</th>
              <th>Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={15} className="grid-empty-row">
                  No hay entregables para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={selectedRowId === row.id ? 'is-selected' : undefined}
                  onClick={() => openRowDetail(row)}
                >
                  <td className="tracking-row-number">{row.rowNumber}</td>
                  <td>{emptyDateDisplay(row.division)}</td>
                  <td className="tracking-product-cell">{emptyDateDisplay(row.product)}</td>
                  <td>{emptyDateDisplay(row.hardwareVersion)}</td>
                  <td>{emptyDateDisplay(row.manualUser)}</td>
                  <td>
                    <span className="tracking-type-pill">{deliveryTypeLabels[row.deliveryType]}</span>
                  </td>
                  <td className="tracking-detail-cell">{emptyDateDisplay(row.documentDetail)}</td>
                  <td>
                    <span className="grid-assignee">
                      <span className="grid-avatar" aria-hidden="true">
                        {getInitials(row.owner)}
                      </span>
                      <span>
                        {row.owner}
                        {row.ownerSource === 'assigned' && row.projectLead && row.projectLead !== row.owner && (
                          <small>Max. resp.: {row.projectLead}</small>
                        )}
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className={`tracking-state-pill ${stateClass(row.dateState)}`}>
                      {row.status || dateStateLabels[row.dateState]}
                    </span>
                  </td>
                  <td>{dateDisplay(row.plannedPublicationDate)}</td>
                  <td>{dateDisplay(row.realPublicationDate)}</td>
                  <td>{dateDisplay(row.expectedReceptionDate)}</td>
                  <td>{dateDisplay(row.realReceptionDate)}</td>
                  <td>{dateDisplay(row.manualDeliveryDeadline)}</td>
                  <td className="tracking-comment-cell">{row.comments || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TrackingDetail row={selectedRow} />
    </div>
  );

  const renderTrackingVisualization = () => {
    if (viewMode === 'planner') {
      return renderTrackingKanban();
    }

    if (viewMode === 'calendar') {
      return <CalendarView rows={trackingComparisonRows} onRowOpen={openComparedRowDetail} />;
    }

    if (viewMode === 'grid') {
      return (
        <section className="tracking-grid-shell" aria-label="Grid Seguimiento de Proyectos">
          <ComparisonTable
            rows={trackingComparisonRows}
            columns={trackingComparisonColumns}
            onRowClick={openComparedRowDetail}
          />
        </section>
      );
    }

    return renderExcelView();
  };

  return (
    <>
      <section className="tracking-source-panel">
        <div>
          <span className="tracking-kicker">Seguimiento Proyectos</span>
          <h2>{viewCopy.title}</h2>
          <p>{viewCopy.description}</p>
        </div>

        <div className="tracking-source-actions">
          {sourceOptions.length > 0 && (
            <label>
              <span>Origen</span>
              <select
                value={sourceKind}
                onChange={(event) => {
                  setSourceKind(event.currentTarget.value as TrackingSourceKind);
                  setFilters(initialFilters);
                }}
              >
                {sourceOptions.map((source) => (
                  <option key={source.kind} value={source.kind}>
                    {source.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {sheetNames.length > 1 && (
            <label>
              <span>Hoja</span>
              <select value={selectedSheetName} onChange={(event) => setSelectedSheetName(event.currentTarget.value)}>
                {sheetNames.map((sheetName) => (
                  <option key={sheetName} value={sheetName}>
                    {sheetName}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="tracking-upload-button">
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  void handleDirectFileSelected(file);
                }
                event.currentTarget.value = '';
              }}
            />
            Subir hoja directamente
          </label>
        </div>
      </section>

      <TrackingViewTabs activeMode={viewMode} onChange={onViewModeChange} />

      {!masterWorkbook && !directWorkbook && (
        <p className="grid-message is-error">
          Carga un Excel maestro que contenga una hoja de Seguimiento Proyectos o sube la hoja directamente.
        </p>
      )}

      {masterWorkbook && !masterHasTrackingSheet && !directWorkbook && (
        <p className="grid-message is-error">
          No se ha encontrado ninguna hoja del Excel maestro que contenga "Seguimiento Proyectos" en el nombre. Puedes
          subir esa hoja directamente desde esta seccion.
        </p>
      )}

      {activeSource && !activeSource.hasPreferredSheet && activeSource.kind === 'direct' && sheetNames.length > 1 && (
        <p className="grid-message is-success">
          El archivo directo no tiene una hoja con "Seguimiento Proyectos" en el nombre. Selecciona manualmente cual
          quieres visualizar.
        </p>
      )}

      {(directError || parsedResult.error) && (
        <p className="grid-message is-error">{directError ?? parsedResult.error}</p>
      )}

      {isDirectProcessing && <p className="grid-message is-success">Procesando hoja de seguimiento...</p>}

      {parsedSheet ? (
        <section className="tracking-view" aria-label="Visualizador Seguimiento de Proyectos">
          <div className="tracking-view-meta">
            <span>{sourceLabel(parsedSheet.sourceKind)}</span>
            <span>{parsedSheet.fileName}</span>
            <span>Hoja: {parsedSheet.sheetName}</span>
            <span>Cabecera fila {parsedSheet.headerRowNumber}</span>
          </div>

          <div className="tracking-metrics">
            <Metric label="filas totales" value={metrics.total} />
            <Metric label="filas visibles" value={metrics.visible} />
            <Metric label="completadas" value={metrics.completed} />
            <Metric label="vencidas" value={metrics.overdue} />
            <Metric label="TBD" value={metrics.tbd} />
          </div>

          <div className="tracking-filters">
            <label className="tracking-search">
              <span>Buscar</span>
              <input
                type="search"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.currentTarget.value }))}
                placeholder="Buscar producto, manual, detalle, persona, comentario o nota"
              />
            </label>
            <SelectFilter
              label="Division"
              value={filters.division}
              options={filterOptions.divisions}
              onChange={(value) => setFilters((current) => ({ ...current, division: value }))}
            />
            <SelectFilter
              label="Producto"
              value={filters.product}
              options={filterOptions.products}
              onChange={(value) => setFilters((current) => ({ ...current, product: value }))}
            />
            <SelectFilter
              label="Version HW"
              value={filters.hardware}
              options={filterOptions.hardware}
              onChange={(value) => setFilters((current) => ({ ...current, hardware: value }))}
            />
            <SelectFilter
              label="Manual"
              value={filters.manual}
              options={filterOptions.manuals}
              onChange={(value) => setFilters((current) => ({ ...current, manual: value }))}
            />
            <SelectFilter
              label="Tipo"
              value={filters.deliveryType}
              options={filterOptions.deliveryTypes}
              onChange={(value) => setFilters((current) => ({ ...current, deliveryType: value }))}
            />
            <SelectFilter
              label="Persona"
              value={filters.owner}
              options={filterOptions.owners}
              onChange={(value) => setFilters((current) => ({ ...current, owner: value }))}
            />
            <SelectFilter
              label="Estado"
              value={filters.status}
              options={filterOptions.statuses}
              onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            />
            <label>
              <span>Fechas</span>
              <select
                value={filters.dateState}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, dateState: event.currentTarget.value as TrackingFilters['dateState'] }))
                }
              >
                <option value="all">Todas</option>
                {Object.entries(dateStateLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary-button grid-clear-button" type="button" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>

          {renderTrackingVisualization()}
        </section>
      ) : (
        <section className="empty-state workspace-empty">
          <h2>Visualizador Seguimiento de Proyectos</h2>
          <p>
            Esta seccion se activara cuando exista una hoja cuyo nombre contenga Seguimiento Proyectos en el Excel
            maestro, o cuando subas esa hoja directamente.
          </p>
        </section>
      )}

      {detailRow && <TrackingFullDetailModal row={detailRow} onClose={() => setDetailRow(null)} />}
    </>
  );
}
