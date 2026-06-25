export type PlanningChangeFilter =
  | "all"
  | "changed"
  | "unchanged"
  | "unmatched"
  | "blocked"
  | "ambiguous";

export interface PlanningFiltersState {
  searchTerm: string;
  project: string;
  assignee: string;
  change: PlanningChangeFilter;
}

export const initialPlanningFilters: PlanningFiltersState = {
  searchTerm: "",
  project: "all",
  assignee: "all",
  change: "all",
};

export const planningChangeOptions = [
  { value: "all", label: "Todos" },
  { value: "changed", label: "Con cambios" },
  { value: "unchanged", label: "Sin cambios" },
  { value: "unmatched", label: "Sin coincidencia" },
  { value: "blocked", label: "Bloqueados" },
  { value: "ambiguous", label: "Ambiguos" },
];
