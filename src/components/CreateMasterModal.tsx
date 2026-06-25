interface CreateMasterModalProps {
  isOpen: boolean;
  plannerFileName: string | null;
  masterFileName: string | null;
  projectName: string;
  changedCount: number;
  unmatchedCount: number;
  ambiguousCount: number;
  canCreate: boolean;
  isCreating: boolean;
  validationMessage: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function CreateMasterModal({
  isOpen,
  plannerFileName,
  masterFileName,
  projectName,
  changedCount,
  unmatchedCount,
  ambiguousCount,
  canCreate,
  isCreating,
  validationMessage,
  onClose,
  onConfirm,
}: CreateMasterModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="create-master-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-master-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="modal-kicker">Copia actualizada</p>
            <h2 id="create-master-title">Crear Excel maestro actualizado</h2>
            <span>Se generará un archivo nuevo. El Excel maestro original no se sobrescribe.</span>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
        </header>

        <dl className="create-master-summary">
          <div>
            <dt>Excel Planner actual</dt>
            <dd>{plannerFileName ?? 'No cargado'}</dd>
          </div>
          <div>
            <dt>Excel maestro base</dt>
            <dd>{masterFileName ?? 'No cargado'}</dd>
          </div>
          <div>
            <dt>Proyecto detectado</dt>
            <dd>{projectName || 'No detectado'}</dd>
          </div>
          <div>
            <dt>Fechas modificadas</dt>
            <dd>{changedCount}</dd>
          </div>
          <div>
            <dt>Sin coincidencia en maestro</dt>
            <dd>{unmatchedCount}</dd>
          </div>
          <div>
            <dt>Coincidencias ambiguas</dt>
            <dd>{ambiguousCount}</dd>
          </div>
        </dl>

        <p className={canCreate ? 'create-master-note is-valid' : 'create-master-note is-blocked'}>
          {validationMessage}
        </p>

        <footer className="file-modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" type="button" disabled={!canCreate || isCreating} onClick={onConfirm}>
            {isCreating ? 'Creando copia...' : 'Crear copia actualizada'}
          </button>
        </footer>
      </section>
    </div>
  );
}
