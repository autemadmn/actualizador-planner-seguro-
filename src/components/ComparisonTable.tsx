import type { ComparedRow } from '../types/comparison';
import type { ExcelColumnInfo } from '../types/excel';
import { ChangedDateCell } from './ChangedDateCell';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';

interface ComparisonTableProps {
  rows: ComparedRow[];
  columns: ExcelColumnInfo[];
}

function getColumnClass(column: ExcelColumnInfo): string {
  if (column.role === 'name') {
    return 'column-name';
  }

  if (column.role === 'startDate' || column.role === 'endDate') {
    return 'column-date';
  }

  if (column.role === 'assignee') {
    return 'column-assignee';
  }

  return '';
}

function getChangeForColumn(row: ComparedRow, column: ExcelColumnInfo) {
  if (column.role === 'startDate') {
    return row.changes.find((change) => change.field === 'startDate');
  }

  if (column.role === 'endDate') {
    return row.changes.find((change) => change.field === 'endDate');
  }

  return undefined;
}

export function ComparisonTable({ rows, columns }: ComparisonTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No hay filas para mostrar"
        description="Ajusta los filtros o carga otros archivos para ver resultados."
      />
    );
  }

  return (
    <div className="table-shell">
      <table className="comparison-table">
        <thead>
          <tr>
            <th className="status-column">Estado</th>
            {columns.map((column) => (
              <th key={column.index} className={getColumnClass(column)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.currentRow.excelRowNumber}-${row.currentRow.normalizedTaskName}-${row.currentRow.normalizedAssignee}`}
              className={row.currentRow.isBold ? 'is-bold-row' : undefined}
            >
              <td className="status-column">
                <StatusBadge row={row} />
              </td>
              {columns.map((column) => {
                const displayValue = row.currentRow.displayValues[column.index] ?? '';
                const change = getChangeForColumn(row, column);
                const isName = column.role === 'name';

                return (
                  <td
                    key={column.index}
                    className={`${getColumnClass(column)} ${change ? 'has-date-change' : ''}`}
                    style={
                      isName
                        ? { paddingLeft: `${12 + row.currentRow.indentationLevel * 18}px` }
                        : undefined
                    }
                  >
                    <ChangedDateCell displayValue={displayValue} change={change} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
