import { useEffect, useMemo, useState } from 'react';
import {
  applyMasterChanges,
  buildMasterChangeCandidates,
  validateMasterProject,
} from '../services/masterExcel';
import type { ComparedRow, FilterOption } from '../types/comparison';
import type { MasterChangeCandidate, MasterChangeStatus, ParsedMasterWorkbook } from '../types/master';
import { assigneeTextMatches, splitAssignees } from '../utils/assignees';
import { formatDateForSpain } from '../utils/dateUtils';
import { getGeneratedExcelFileName } from '../utils/generatedExcel';
import { normalizeText } from '../utils/normalizeText';
import type { PlanningChangeFilter } from '../utils/planningFilters';
import { initialPlanningFilters } from '../utils/planningFilters';
import { getDueDate, getInitials, inferRowHierarchy } from '../utils/plannerData';
import { EmptyState } from './EmptyState';
import { PlanningFiltersBar } from './PlanningFiltersBar';

interface GridViewProps {
  rows: ComparedRow[];
  masterWorkbook: ParsedMasterWorkbook | null;
  plannerProjectName: string;
  onMasterUpdated?: () => void;
}

interface GridItem {
  candidate: MasterChangeCandidate;
  taskName: string;
  project: string;
  assignee: string;
  statusText: string;
  startDate: string | null;
  dueDate: string | null;
  weekLabel: string;
  observations: string;
  searchText: string;
}

const statusLabels: Record<MasterChangeStatus, string> = {
  ready: 'Cambio listo',
  blocked: 'Cambio bloqueado',
  ambiguous: 'Coincidencia ambigua',
  not_found: 'No encontrada',
  project_blocked: 'Proyecto no validado',
  no_change: 'Sin cambios',
};

function formatOptionalDate(value: string | null): string {
  return value ? formatDateForSpain(value) : 'Sin fecha';
}

function getWeekLabel(value: string | null): string {
  if (!value) {
    return '';
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `S${String(week).padStart(2, '0')} ${date.getUTCFullYear()}`;
}

function statusClass(status: MasterChangeStatus): string {
  if (status === 'ready') {
    return 'ready';
  }

  if (status === 'no_change') {
    return 'neutral';
  }

  return 'blocked';
}

function isBlockedStatus(status: MasterChangeStatus): boolean {
  return status === 'blocked' || status === 'ambiguous' || status === 'not_found' || status === 'project_blocked';
}

function changeText(candidate: MasterChangeCandidate): string {
  if (candidate.changes.length === 0) {
    return candidate.observation;
  }

  return candidate.changes
    .map(
      (change) =>
        `${change.label}: ${formatOptionalDate(change.previous)} a ${formatOptionalDate(change.current)}`,
    )
    .join(' | ');
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildGridItems(
  rows: ComparedRow[],
  candidates: MasterChangeCandidate[],
  plannerProjectName: string,
): GridItem[] {
  const contexts = inferRowHierarchy(rows);

  return candidates.map((candidate) => {
    const row = candidate.comparedRow;
    const context = contexts.get(row);
    const project = context?.project && context.project !== 'Sin proyecto'
      ? context.project
      : plannerProjectName || 'Sin proyecto';
    const taskName = row.currentRow.taskName.trim() || 'Sin nombre';
    const assignee = row.currentRow.assignee.trim() || candidate.masterRow?.assignee || 'Sin asignar';
    const dueDate = getDueDate(row);
    const observations = candidate.masterRow?.observations || candidate.observation;
    const statusText = candidate.masterRow?.status || statusLabels[candidate.status];

    return {
      candidate,
      taskName,
      project,
      assignee,
      statusText,
      startDate: row.currentRow.startDate,
      dueDate,
      weekLabel: getWeekLabel(dueDate),
      observations,
      searchText: normalizeText(
        [
          taskName,
          project,
          assignee,
          statusText,
          observations,
          changeText(candidate),
        ].join(' '),
      ),
    };
  });
}

function matchesStatusFilter(candidate: MasterChangeCandidate, filter: PlanningChangeFilter): boolean {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'changed') {
    return candidate.changes.length > 0;
  }

  if (filter === 'unchanged') {
    return candidate.status === 'no_change';
  }

  if (filter === 'unmatched') {
    return candidate.status === 'not_found';
  }

  if (filter === 'blocked') {
    return candidate.status === 'blocked' || candidate.status === 'project_blocked';
  }

  return candidate.status === 'ambiguous';
}

function optionsFromLabels(labels: string[]): FilterOption[] {
  return labels.map((label) => ({
    value: label,
    label,
    normalized: normalizeText(label),
  }));
}

export function GridView({
  rows,
  masterWorkbook,
  plannerProjectName,
  onMasterUpdated,
}: GridViewProps) {
  const [filters, setFilters] = useState(initialPlanningFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [appliedVersion, setAppliedVersion] = useState(0);

  const validation = useMemo(
    () => validateMasterProject(masterWorkbook, plannerProjectName),
    [masterWorkbook, plannerProjectName, appliedVersion],
  );
  const candidates = useMemo(
    () => buildMasterChangeCandidates(masterWorkbook, rows, plannerProjectName),
    [masterWorkbook, rows, plannerProjectName, appliedVersion],
  );
  const items = useMemo(
    () => buildGridItems(rows, candidates, plannerProjectName),
    [rows, candidates, plannerProjectName],
  );

  useEffect(() => {
    const validIds = new Set(candidates.map((candidate) => candidate.id));
    setSelectedIds((current) => new Set(Array.from(current).filter((id) => validIds.has(id))));
  }, [candidates]);

  const projects = useMemo(
    () => Array.from(new Set(items.map((item) => item.project))).sort((left, right) => left.localeCompare(right, 'es')),
    [items],
  );
  const projectOptions = useMemo(() => optionsFromLabels(projects), [projects]);
  const assignees = useMemo(
    () =>
      Array.from(
        new Map(
          items.flatMap((item) =>
            splitAssignees(item.assignee).map((person) => [person.normalized, person.label] as const),
          ),
        ).values(),
      ).sort((left, right) => left.localeCompare(right, 'es')),
    [items],
  );
  const assigneeOptions = useMemo(() => optionsFromLabels(assignees), [assignees]);
  const normalizedSearch = normalizeText(filters.searchTerm);
  const filteredItems = items.filter((item) => {
    const matchesSearch = !normalizedSearch || item.searchText.includes(normalizedSearch);
    const matchesProject = filters.project === 'all' || item.project === filters.project;
    const matchesAssignee =
      filters.assignee === 'all' || assigneeTextMatches(item.assignee, new Set([normalizeText(filters.assignee)]));
    const matchesStatus = matchesStatusFilter(item.candidate, filters.change);
    return matchesSearch && matchesProject && matchesAssignee && matchesStatus;
  });
  const selectedCandidates = candidates.filter((candidate) => selectedIds.has(candidate.id));
  const selectedReadyCandidates = selectedCandidates.filter((candidate) => candidate.status === 'ready');
  const readyCount = candidates.filter((candidate) => candidate.status === 'ready').length;
  const blockedCount = candidates.filter((candidate) => isBlockedStatus(candidate.status)).length;
  const changedCount = candidates.filter((candidate) => candidate.changes.length > 0).length;
  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.candidate.id));

  const toggleRowSelection = (id: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleFilteredSelection = (): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredItems.forEach((item) => next.delete(item.candidate.id));
      } else {
        filteredItems.forEach((item) => next.add(item.candidate.id));
      }
      return next;
    });
  };

  const clearFilters = (): void => {
    setFilters(initialPlanningFilters);
  };

  const handleApplyChanges = async (): Promise<void> => {
    setApplyError(null);
    setApplySuccess(null);

    if (!masterWorkbook) {
      setApplyError('Carga primero el Excel maestro antes de aplicar cambios.');
      return;
    }

    if (validation.status !== 'valid') {
      setApplyError(validation.message);
      return;
    }

    if (selectedReadyCandidates.length === 0) {
      setApplyError('Selecciona al menos una fila con cambio validado para generar el Excel maestro actualizado.');
      return;
    }

    setIsApplying(true);
    try {
      const blob = await applyMasterChanges(masterWorkbook, selectedReadyCandidates);
      downloadBlob(blob, getGeneratedExcelFileName());
      setAppliedVersion((version) => version + 1);
      onMasterUpdated?.();
      setSelectedIds(new Set());
      setApplySuccess(
        `Excel maestro actualizado generado con ${selectedReadyCandidates.length} cambio(s) validado(s).`,
      );
    } catch {
      setApplyError('Error al generar el Excel maestro actualizado.');
    } finally {
      setIsApplying(false);
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No hay datos de Planner para mostrar en Grid"
        description="Carga el Excel de Planner actual y el Excel maestro para revisar coincidencias, cambios y filas bloqueadas."
      />
    );
  }

  return (
    <>
      <PlanningFiltersBar
        filters={filters}
        projectOptions={projectOptions}
        assigneeOptions={assigneeOptions}
        onFiltersChange={setFilters}
        onClearFilters={clearFilters}
      />

      <section className="grid-view" aria-label="Vista Tabla">
      <div className="grid-action-bar">
        <div className="grid-counts">
          <strong>{filteredItems.length}</strong> filas visibles
          <span>{selectedIds.size} seleccionadas</span>
          <span>{readyCount} cambios listos</span>
          <span>{blockedCount} bloqueadas</span>
        </div>
        <div className="grid-actions">
          <button className="secondary-button" type="button" onClick={toggleFilteredSelection}>
            {allFilteredSelected ? 'Quitar selección visible' : 'Seleccionar filtradas'}
          </button>
          <button className="secondary-button" type="button" onClick={() => setSelectedIds(new Set())}>
            Limpiar selección
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setFilters((current) => ({ ...current, change: 'changed' }))}
          >
            Ver cambios detectados
          </button>
          <button className="secondary-button grid-add-row" type="button" disabled>
            + Añadir fila
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={isApplying || selectedReadyCandidates.length === 0 || validation.status !== 'valid'}
            onClick={() => void handleApplyChanges()}
          >
            {isApplying ? 'Creando copia...' : 'Crea Excel Maestro Actualizado'}
          </button>
        </div>
      </div>

      {applyError && <p className="grid-message is-error">{applyError}</p>}
      {applySuccess && <p className="grid-message is-success">{applySuccess}</p>}

      <div className="grid-summary">
        <span>{changedCount} filas con diferencias frente al maestro</span>
        <span>{selectedReadyCandidates.length} cambios validados se aplicarán al confirmar</span>
      </div>

      <div className="grid-table-shell">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="grid-check-column">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleFilteredSelection}
                  aria-label="Seleccionar todas las filas filtradas"
                />
              </th>
              <th>Nombre</th>
              <th>Proyecto / plan</th>
              <th>Responsable</th>
              <th>Estado</th>
              <th>Fecha prevista</th>
              <th>Fecha real</th>
              <th>Semana</th>
              <th>Cambios detectados</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={10} className="grid-empty-row">
                  No hay filas para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.candidate.id} className={`grid-row-${statusClass(item.candidate.status)}`}>
                  <td className="grid-check-column">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.candidate.id)}
                      onChange={() => toggleRowSelection(item.candidate.id)}
                      aria-label={`Seleccionar ${item.taskName}`}
                    />
                  </td>
                  <td className="grid-name-cell">
                    <span>{item.taskName}</span>
                  </td>
                  <td>{item.project}</td>
                  <td>
                    <span className="grid-assignee">
                      <span className="grid-avatar" aria-hidden="true">
                        {getInitials(item.assignee)}
                      </span>
                      {item.assignee}
                    </span>
                  </td>
                  <td>
                    <span className={`grid-status-pill status-${statusClass(item.candidate.status)}`}>
                      {statusLabels[item.candidate.status]}
                    </span>
                    {item.statusText !== statusLabels[item.candidate.status] && (
                      <span className="grid-native-status">{item.statusText}</span>
                    )}
                  </td>
                  <td>{formatOptionalDate(item.startDate)}</td>
                  <td>{formatOptionalDate(item.dueDate)}</td>
                  <td>{item.weekLabel || '-'}</td>
                  <td>
                    {item.candidate.changes.length > 0 ? (
                      <ul className="grid-change-list">
                        {item.candidate.changes.map((change) => (
                          <li key={`${item.candidate.id}-${change.field}`}>
                            <strong>{change.label}</strong>
                            <span>
                              {formatOptionalDate(change.previous)} a {formatOptionalDate(change.current)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="grid-muted">{item.candidate.observation}</span>
                    )}
                  </td>
                  <td>{item.observations}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
    </>
  );
}
