interface HeaderProps {
  canCreateMaster: boolean;
  onCreateMaster: () => void;
  onOpenMenu: () => void;
}

export function Header({ canCreateMaster, onCreateMaster, onOpenMenu }: HeaderProps) {
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
        <button className="header-menu-button" type="button" aria-label="Abrir menu lateral" onClick={onOpenMenu}>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
