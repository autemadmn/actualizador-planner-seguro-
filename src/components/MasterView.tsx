import { useEffect, useMemo, useState } from 'react';
import type { FilterOption } from '../types/comparison';
import type { MasterChangeCandidate, ParsedMasterWorkbook } from '../types/master';
import { assigneeTextMatches, splitAssignees } from '../utils/assignees';
import { formatDateForSpain } from '../utils/dateUtils';
import { normalizeText } from '../utils/normalizeText';
import type { PlanningChangeFilter } from '../utils/planningFilters';
import { initialPlanningFilters } from '../utils/planningFilters';
import { getInitials, inferRowHierarchy } from '../utils/plannerData';
import { MasterWorksheetEditor } from './MasterWorksheetEditor';
import { PlanningFiltersBar } from './PlanningFiltersBar';

interface MasterViewProps {
  candidates: MasterChangeCandidate[];
  masterWorkbook: ParsedMasterWorkbook | null;
}

interface ReviewItem {
  candidate: MasterChangeCandidate;
  project: string;
  taskName: string;
  assignee: string;
  previousStart: string | null;
  currentStart: string | null;
  previousEnd: string | null;
  currentEnd: string | null;
  changedFieldsLabel: string;
  statusLabel: string;
  searchText: string;
}

function displayDate(value: string | null): string {
  return formatDateForSpain(value) || '-';
}

function changeValue(candidate: MasterChangeCandidate, field: 'startDate' | 'endDate', side: 'previous' | 'current') {
  return candidate.changes.find((change) => change.field === field)?.[side] ?? null;
}

function fallbackCurrentDate(candidate: MasterChangeCandidate, field: 'startDate' | 'endDate'): string | null {
  return field === 'startDate'
    ? candidate.comparedRow.currentRow.startDate
    : candidate.comparedRow.currentRow.endDate;
}

function changedFieldsLabel(candidate: MasterChangeCandidate): string {
  const fields = new Set(candidate.changes.map((change) => change.field));
  if (fields.has('startDate') && fields.has('endDate')) {
    return 'Inicio y fin';
  }

  if (fields.has('startDate')) {
    return 'Inicio';
  }

  if (fields.has('endDate')) {
    return 'Fin';
  }

  return '-';
}

function statusLabel(candidate: MasterChangeCandidate): string {
  if (candidate.status === 'ready') {
    return 'Fecha modificada';
  }

  if (candidate.status === 'ambiguous') {
    return 'Coincidencia ambigua';
  }

  if (candidate.status === 'not_found') {
    return 'Sin coincidencia en maestro';
  }

  if (candidate.status === 'blocked' || candidate.status === 'project_blocked') {
    return 'Bloqueada';
  }

  return 'Sin cambios';
}

function shouldShowInReview(candidate: MasterChangeCandidate): boolean {
  return candidate.changes.length > 0 || candidate.status === 'ambiguous' || candidate.status === 'not_found';
}

function buildReviewItems(candidates: MasterChangeCandidate[]): ReviewItem[] {
  const rows = candidates.map((candidate) => candidate.comparedRow);
  const contexts = inferRowHierarchy(rows);

  return candidates.filter(shouldShowInReview).map((candidate) => {
    const row = candidate.comparedRow.currentRow;
    const context = contexts.get(candidate.comparedRow);
    const project = context?.project && context.project !== 'Sin proyecto'
      ? context.project
      : candidate.projectName || 'Sin proyecto';
    const taskName = row.taskName.trim() || 'Sin nombre';
    const assignee = row.assignee.trim() || candidate.masterRow?.assignee || 'Sin asignar';
    const previousStart = changeValue(candidate, 'startDate', 'previous');
    const currentStart = changeValue(candidate, 'startDate', 'current') ?? fallbackCurrentDate(candidate, 'startDate');
    const previousEnd = changeValue(candidate, 'endDate', 'previous');
    const currentEnd = changeValue(candidate, 'endDate', 'current') ?? fallbackCurrentDate(candidate, 'endDate');
    const fieldsLabel = changedFieldsLabel(candidate);
    const candidateStatusLabel = statusLabel(candidate);

    return {
      candidate,
      project,
      taskName,
      assignee,
      previousStart,
      currentStart,
      previousEnd,
      currentEnd,
      changedFieldsLabel: fieldsLabel,
      statusLabel: candidateStatusLabel,
      searchText: normalizeText(
        [
          taskName,
          project,
          assignee,
          fieldsLabel,
          candidateStatusLabel,
          candidate.observation,
          ...candidate.changes.flatMap((change) => [change.previous, change.current, change.label]),
        ].join(' '),
      ),
    };
  });
}

function matchesChangeFilter(item: ReviewItem, filter: PlanningChangeFilter): boolean {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'changed') {
    return item.candidate.changes.length > 0;
  }

  if (filter === 'unchanged') {
    return item.candidate.status === 'no_change';
  }

  if (filter === 'unmatched') {
    return item.candidate.status === 'not_found';
  }

  if (filter === 'blocked') {
    return item.candidate.status === 'blocked' || item.candidate.status === 'project_blocked';
  }

  return item.candidate.status === 'ambiguous';
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, 'es'));
}

function optionsFromLabels(labels: string[]): FilterOption[] {
  return labels.map((label) => ({
    value: label,
    label,
    normalized: normalizeText(label),
  }));
}

function buildSelectedSummary(item: ReviewItem | null): string {
  if (!item) {
    return 'Selecciona una fila modificada para buscar coincidencias en el maestro.';
  }

  const parts = [`Cambio seleccionado: ${item.taskName}`];

  if (item.previousStart || item.currentStart) {
    parts.push(`Inicio: ${displayDate(item.previousStart)} -> ${displayDate(item.currentStart)}`);
  }

  if (item.previousEnd || item.currentEnd) {
    parts.push(`Fin: ${displayDate(item.previousEnd)} -> ${displayDate(item.currentEnd)}`);
  }

  parts.push(`Campos: ${item.changedFieldsLabel}`);
  return parts.join(' · ');
}

export function MasterView({ candidates, masterWorkbook }: MasterViewProps) {
  const [filters, setFilters] = useState(initialPlanningFilters);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [autoDateFilterRequest, setAutoDateFilterRequest] = useState(0);

  const reviewItems = useMemo(() => buildReviewItems(candidates), [candidates]);
  const projectOptions = useMemo(
    () => optionsFromLabels(uniqueSorted(reviewItems.map((item) => item.project))),
    [reviewItems],
  );
  const assigneeOptions = useMemo(
    () =>
      optionsFromLabels(
        uniqueSorted(reviewItems.flatMap((item) => splitAssignees(item.assignee).map((person) => person.label))),
      ),
    [reviewItems],
  );
  const normalizedSearch = normalizeText(filters.searchTerm);
  const filteredItems = reviewItems.filter((item) => {
    const matchesSearch = !normalizedSearch || item.searchText.includes(normalizedSearch);
    const matchesProject = filters.project === 'all' || item.project === filters.project;
    const matchesAssignee =
      filters.assignee === 'all' || assigneeTextMatches(item.assignee, new Set([normalizeText(filters.assignee)]));
    const matchesChange = matchesChangeFilter(item, filters.change);

    return matchesSearch && matchesProject && matchesAssignee && matchesChange;
  });

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedCandidateId(null);
      return;
    }

    if (!selectedCandidateId || !filteredItems.some((item) => item.candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(filteredItems[0].candidate.id);
    }
  }, [filteredItems, selectedCandidateId]);

  const selectedItem =
    filteredItems.find((item) => item.candidate.id === selectedCandidateId) ??
    reviewItems.find((item) => item.candidate.id === selectedCandidateId) ??
    null;
  const selectedCandidate = selectedItem?.candidate ?? null;
  const previousDates = selectedCandidate?.changes
    .map((change) => change.previous)
    .filter((date): date is string => Boolean(date)) ?? [];

  return (
    <>
      <PlanningFiltersBar
        filters={filters}
        projectOptions={projectOptions}
        assigneeOptions={assigneeOptions}
        onFiltersChange={setFilters}
        onClearFilters={() => setFilters(initialPlanningFilters)}
      />

      <section className="master-view" aria-label="Excel maestro">
      <div className="master-workspace">
        <section className="master-changes-panel" aria-label="Cambios detectados en Planner">
          <div className="master-section-heading">
            <h2>Cambios detectados en Planner</h2>
            <span className="master-inline-count">
              {filteredItems.length} visibles · {reviewItems.length} para revisar
            </span>
          </div>

          <div className="master-change-table-shell">
            <table className="master-change-table">
              <thead>
                <tr>
                  <th>Tarea</th>
                  <th>Proyecto / plan</th>
                  <th>Asignado a</th>
                  <th>Inicio anterior</th>
                  <th>Inicio actual</th>
                  <th>Fin anterior</th>
                  <th>Fin actual</th>
                  <th>Campos</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="grid-empty-row">
                      No hay cambios detectados para los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr
                      key={item.candidate.id}
                      className={selectedCandidateId === item.candidate.id ? 'is-selected' : undefined}
                      onClick={() => setSelectedCandidateId(item.candidate.id)}
                    >
                      <td className="master-task-cell">{item.taskName}</td>
                      <td>{item.project}</td>
                      <td>
                        <span className="grid-assignee">
                          <span className="grid-avatar" aria-hidden="true">
                            {getInitials(item.assignee)}
                          </span>
                          {item.assignee}
                        </span>
                      </td>
                      <td>{displayDate(item.previousStart)}</td>
                      <td>{displayDate(item.currentStart)}</td>
                      <td>{displayDate(item.previousEnd)}</td>
                      <td>{displayDate(item.currentEnd)}</td>
                      <td>{item.changedFieldsLabel}</td>
                      <td>{item.statusLabel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="master-selected-compact">
            <p>{buildSelectedSummary(selectedItem)}</p>
            <button
              className="primary-button"
              type="button"
              disabled={!selectedItem || previousDates.length === 0}
              onClick={() => setAutoDateFilterRequest((request) => request + 1)}
            >
              Buscar coincidencias en Seguimiento Proyectos
            </button>
          </div>
        </section>

        <MasterWorksheetEditor
          masterWorkbook={masterWorkbook}
          selectedCandidate={selectedCandidate}
          autoDateFilterRequest={autoDateFilterRequest}
        />
      </div>
    </section>
    </>
  );
}
