export type ComparedRowStatus =
  | "changed"
  | "unchanged"
  | "unmatched"
  | "blocked"
  | "ambiguous";

export interface ComparedFieldDiff {
  field: string;
  previous: string | null;
  current: string | null;
}

export interface ComparedRow {
  key: string;
  status: ComparedRowStatus;
  diffs: ComparedFieldDiff[];

  taskName?: string;
  assignee?: string;
  projectName?: string | null;

  planner?: any;   // TODO tipado posterior
  master?: any;    // TODO tipado posterior

  blockedReason?: string;
}
``
