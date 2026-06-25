import { formatDateForSpain } from '../utils/dateUtils';

interface FileStatusBarProps {
  plannerFileName: string | null;
  plannerReady: boolean;
  masterFileName: string | null;
  masterReady: boolean;
  lastLoadAt: Date | null;
  onChangeFiles: () => void;
}

function statusLabel(isReady: boolean): string {
  return isReady ? 'Validado' : 'Pendiente';
}

function fileNameLabel(fileName: string | null): string {
  return fileName ?? 'No cargado';
}

function formatLastLoad(value: Date | null): string {
  if (!value) {
    return '—';
  }

  const date = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate(),
  ).padStart(2, '0')}`;
  const time = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  return `${formatDateForSpain(date)} ${time}`;
}

export function FileStatusBar({
  plannerFileName,
  plannerReady,
  masterFileName,
  masterReady,
  lastLoadAt,
  onChangeFiles,
}: FileStatusBarProps) {
  const excelLogoUrl = `${import.meta.env.BASE_URL}excellogo.png`;

  return (
    <section className="file-status-card" aria-label="Archivos cargados">
      <div className="file-status-item">
        <img className="file-status-icon" src={excelLogoUrl} alt="" aria-hidden="true" />
        <div>
          <strong>Excel de Planner (actual)</strong>
          <span>{fileNameLabel(plannerFileName)}</span>
        </div>
        <em className={plannerReady ? 'badge-ready' : 'badge-pending'}>{statusLabel(plannerReady)}</em>
      </div>

      <div className="file-status-item">
        <img className="file-status-icon" src={excelLogoUrl} alt="" aria-hidden="true" />
        <div>
          <strong>Excel maestro</strong>
          <span>{fileNameLabel(masterFileName)}</span>
        </div>
        <em className={masterReady ? 'badge-ready' : 'badge-pending'}>{statusLabel(masterReady)}</em>
      </div>

      <div className="file-status-item file-status-time">
        <span className="file-status-time-icon" aria-hidden="true">
          ◷
        </span>
        <div>
          <strong>Última carga</strong>
          <span>{formatLastLoad(lastLoadAt)}</span>
        </div>
      </div>

      <button className="file-change-button" type="button" onClick={onChangeFiles}>
        <span aria-hidden="true">▣</span>
        Cambiar archivos
      </button>
    </section>
  );
}
