import type { DateChange } from '../types/comparison';
import { formatDateForSpain } from '../utils/dateUtils';

interface ChangedDateCellProps {
  displayValue: string;
  change?: DateChange;
}

export function ChangedDateCell({ displayValue, change }: ChangedDateCellProps) {
  if (!change) {
    return <span>{displayValue}</span>;
  }

  const previous = formatDateForSpain(change.previous) || 'Sin fecha';
  const current = formatDateForSpain(change.current) || 'Sin fecha';
  const tooltip = `Fecha modificada\nAnterior: ${previous}\nActual: ${current}`;

  return (
    <span className="changed-date-cell" tabIndex={0} data-tooltip={tooltip} title={tooltip}>
      {displayValue || 'Sin fecha'}
    </span>
  );
}
