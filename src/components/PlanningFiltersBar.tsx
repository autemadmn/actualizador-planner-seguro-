import type { FilterOption } from '../types/comparison';
import type { PlanningChangeFilter, PlanningFilters } from '../utils/planningFilters';
import { planningChangeOptions } from '../utils/planningFilters';

interface PlanningFiltersBarProps {
  filters: PlanningFilters;
  projectOptions: FilterOption[];
  assigneeOptions: FilterOption[];
  onFiltersChange: (filters: PlanningFilters) => void;
  onClearFilters: () => void;
}

export function PlanningFiltersBar({
  filters,
  projectOptions,
  assigneeOptions,
  onFiltersChange,
  onClearFilters,
}: PlanningFiltersBarProps) {
  return (
    <div className="grid-toolbar" aria-label="Filtros de planificación">
      <label className="grid-search">
        <span>Buscar</span>
        <input
          type="search"
          value={filters.searchTerm}
          onChange={(event) => onFiltersChange({ ...filters, searchTerm: event.currentTarget.value })}
          placeholder="Buscar por nombre, proyecto, responsable u observación"
        />
      </label>

      <label>
        <span>Proyecto</span>
        <select
          value={filters.project}
          onChange={(event) => onFiltersChange({ ...filters, project: event.currentTarget.value })}
        >
          <option value="all">Todos</option>
          {projectOptions.map((project) => (
            <option key={project.normalized} value={project.label}>
              {project.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Asignado a</span>
        <select
          value={filters.assignee}
          onChange={(event) => onFiltersChange({ ...filters, assignee: event.currentTarget.value })}
        >
          <option value="all">Todos</option>
          {assigneeOptions.map((assignee) => (
            <option key={assignee.normalized} value={assignee.label}>
              {assignee.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Cambios</span>
        <select
          value={filters.change}
          onChange={(event) =>
            onFiltersChange({ ...filters, change: event.currentTarget.value as PlanningChangeFilter })
          }
        >
          {planningChangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button className="secondary-button grid-clear-button" type="button" onClick={onClearFilters}>
        Limpiar filtros
      </button>
    </div>
  );
}
