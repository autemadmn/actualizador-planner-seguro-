import type { ComparedRow } from '../types/comparison';
import { formatDateForSpain } from '../utils/dateUtils';
import { StatusBadge } from './StatusBadge';

interface EventDetailModalProps {
  row: ComparedRow;
  project?: string;
  dueDate?: string | null;
  onClose: () => void;
}

function readableDate(value: string | null): string {
  return formatDateForSpain(value) || 'Sin fecha';
}

export function EventDetailModal({ row, project, dueDate, onClose }: EventDetailModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="event-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="modal-kicker">Detalle de tarea</p>
            <h2 id="event-modal-title">{row.currentRow.taskName.trim() || 'Sin nombre'}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar detalle" onClick={onClose}>
            ×
          </button>
        </header>

        <dl className="detail-grid">
          {project && (
            <div>
              <dt>Proyecto</dt>
              <dd>{project}</dd>
            </div>
          )}
          <div>
            <dt>Responsable</dt>
            <dd>{row.currentRow.assignee || 'Sin asignar'}</dd>
          </div>
          {dueDate !== undefined && (
            <div>
              <dt>Vencimiento</dt>
              <dd>{readableDate(dueDate)}</dd>
            </div>
          )}
          <div>
            <dt>Inicio actual</dt>
            <dd>{readableDate(row.currentRow.startDate)}</dd>
          </div>
          <div>
            <dt>Finalización actual</dt>
            <dd>{readableDate(row.currentRow.endDate)}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <StatusBadge row={row} />
            </dd>
          </div>
        </dl>

        {row.changes.length > 0 && (
          <section className="change-detail">
            <h3>Fechas modificadas</h3>
            {row.changes.map((change) => (
              <p key={change.field}>
                <strong>{change.label}:</strong> {readableDate(change.previous)} →{' '}
                {readableDate(change.current)}
              </p>
            ))}
          </section>
        )}

        {row.status === 'unmatched' && (
          <section className="change-detail subtle">
            <h3>Sin coincidencia en maestro</h3>
            {row.suggestedMatches.length > 0 ? (
              <p>
                Posible coincidencia no aplicada automáticamente:{' '}
                {row.suggestedMatches.map((match) => match.taskName.trim()).join(', ')}
              </p>
            ) : (
              <p>No se ha encontrado una fila del maestro con la misma clave de nombre y responsable.</p>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
