import { useId } from 'react';

interface FileChangeModalProps {
  isOpen: boolean;
  plannerFileName: string | null;
  plannerReady: boolean;
  plannerError: string | null;
  masterFileName: string | null;
  masterReady: boolean;
  masterError: string | null;
  onPlannerFileSelected: (file: File) => void;
  onMasterFileSelected: (file: File) => void;
  onClose: () => void;
}

function firstFile(fileList: FileList | null): File | null {
  return fileList && fileList.length > 0 ? fileList[0] : null;
}

function UploadRow({
  id,
  label,
  helper,
  fileName,
  isReady,
  error,
  onFileSelected,
}: {
  id: string;
  label: string;
  helper: string;
  fileName: string | null;
  isReady: boolean;
  error: string | null;
  onFileSelected: (file: File) => void;
}) {
  return (
    <div className="file-modal-row">
      <div>
        <strong>{label}</strong>
        <span>{helper}</span>
      </div>
      <input
        id={id}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(event) => {
          const file = firstFile(event.currentTarget.files);
          if (file) {
            onFileSelected(file);
          }
        }}
      />
      <label className="file-modal-picker" htmlFor={id}>
        Seleccionar .xlsx
      </label>
      <p className="file-modal-current">
        {fileName ?? 'No cargado'}
        <em className={isReady ? 'badge-ready' : 'badge-pending'}>{isReady ? 'Validado' : 'Pendiente'}</em>
      </p>
      {error && <p className="file-modal-error">{error}</p>}
    </div>
  );
}

export function FileChangeModal({
  isOpen,
  plannerFileName,
  plannerReady,
  plannerError,
  masterFileName,
  masterReady,
  masterError,
  onPlannerFileSelected,
  onMasterFileSelected,
  onClose,
}: FileChangeModalProps) {
  const plannerInputId = useId();
  const masterInputId = useId();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="file-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="modal-kicker">Archivos de trabajo</p>
            <h2 id="file-modal-title">Cambiar archivos</h2>
            <span>Carga el Excel exportado de Planner y el Excel maestro que se usará como base.</span>
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="file-modal-body">
          <UploadRow
            id={plannerInputId}
            label="Excel de Planner actual"
            helper="Archivo exportado desde Planner con la planificación actual."
            fileName={plannerFileName}
            isReady={plannerReady}
            error={plannerError}
            onFileSelected={onPlannerFileSelected}
          />
          <UploadRow
            id={masterInputId}
            label="Excel maestro"
            helper="Archivo principal que se usará para crear la copia actualizada."
            fileName={masterFileName}
            isReady={masterReady}
            error={masterError}
            onFileSelected={onMasterFileSelected}
          />
        </div>

        <footer className="file-modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" type="button" onClick={onClose}>
            Validar archivos
          </button>
        </footer>
      </section>
    </div>
  );
}
