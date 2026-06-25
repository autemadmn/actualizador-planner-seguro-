import { useId, useState } from 'react';

interface FileUploadCardProps {
  label: string;
  helperText: string;
  fileName: string | null;
  error: string | null;
  isReady: boolean;
  onFileSelected: (file: File) => void;
  onClearFile: () => void;
}

function getFirstFile(fileList: FileList | null): File | null {
  return fileList && fileList.length > 0 ? fileList[0] : null;
}

export function FileUploadCard({
  label,
  helperText,
  fileName,
  error,
  isReady,
  onFileSelected,
  onClearFile,
}: FileUploadCardProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const excelLogoUrl = `${import.meta.env.BASE_URL}excellogo.png`;

  const handleFile = (file: File | null): void => {
    if (file) {
      onFileSelected(file);
    }
  };

  return (
    <section
      className={`upload-card ${isDragging ? 'is-dragging' : ''} ${isReady ? 'is-ready' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFile(getFirstFile(event.dataTransfer.files));
      }}
    >
      <div className="upload-card-header">
        <img className="upload-file-icon" src={excelLogoUrl} alt="" aria-hidden="true" />
        <div>
          <h2>{label}</h2>
          <p>{helperText}</p>
        </div>
      </div>

      <div className="upload-dropzone">
        <input
          id={inputId}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => handleFile(getFirstFile(event.currentTarget.files))}
        />
        <label htmlFor={inputId}>
          <span className="upload-action">Explorar en tu dispositivo</span>
          <span className="upload-hint">Selecciona o arrastra un archivo Excel .xlsx</span>
        </label>
      </div>

      {fileName && (
        <div className="selected-file-row">
          <img className="selected-file-icon" src={excelLogoUrl} alt="" aria-hidden="true" />
          <span className="selected-file-info">
            <strong>{fileName}</strong>
            <span>{isReady ? 'Excel validado' : 'Excel seleccionado'}</span>
          </span>
          <button type="button" onClick={onClearFile}>
            Quitar
          </button>
        </div>
      )}
      {error && <p className="upload-error">{error}</p>}
      {isReady && !error && <p className="upload-ready">Archivo validado</p>}
    </section>
  );
}
