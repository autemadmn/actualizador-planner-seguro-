interface SummaryBarProps {
  visibleCount: number;
  changedCount: number;
  unmatchedCount: number;
}

export function SummaryBar({ visibleCount, changedCount, unmatchedCount }: SummaryBarProps) {
  return (
    <div className="summary-bar" aria-live="polite">
      <span className="summary-item summary-visible">
        <strong>{visibleCount}</strong> filas mostradas
      </span>
      <span className="summary-item summary-changed">
        <strong>{changedCount}</strong> con fechas modificadas
      </span>
      <span className="summary-item summary-unmatched">
        <strong>{unmatchedCount}</strong> sin coincidencia en maestro
      </span>
    </div>
  );
}
