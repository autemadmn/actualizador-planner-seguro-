interface HeaderProps {
  canCreateMaster: boolean;
  onCreateMaster: () => void;
}

export function Header({ canCreateMaster, onCreateMaster }: HeaderProps) {
  const peLogoUrl = `${import.meta.env.BASE_URL}power-electronics-transparente.webp`;

  return (
    <header className="app-header">
      <div className="header-title-group">
        <img className="header-company-logo" src={peLogoUrl} alt="Power Electronics" />
        <div>
          <h1>Actualizador Planner</h1>
        </div>
      </div>
      <div className="header-actions">
        <button
          className="header-create-button"
          type="button"
          onClick={onCreateMaster}
          disabled={!canCreateMaster}
        >
          Crea Excel Maestro Actualizado
        </button>
        <button className="header-more-button" type="button" aria-label="Más opciones">
          ⋮
        </button>
      </div>
    </header>
  );
}
