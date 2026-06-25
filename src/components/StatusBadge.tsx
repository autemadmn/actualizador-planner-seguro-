import type { ComparedRow, RowStatus } from '../types/comparison';

interface StatusBadgeProps {
  row: ComparedRow;
}

const labels: Record<RowStatus, string> = {
  unchanged: 'Sin cambios',
  date_changed: 'Fecha modificada',
  unmatched: 'Sin coincidencia en maestro',
  ambiguous: 'Coincidencia ambigua',
};

export function StatusBadge({ row }: StatusBadgeProps) {
  return (
    <span className="status-badges">
      <span className={`status-badge status-${row.status}`}>{labels[row.status]}</span>
      {row.isAmbiguous && row.status !== 'ambiguous' && (
        <span className="status-badge status-ambiguous">Coincidencia ambigua</span>
      )}
    </span>
  );
}
