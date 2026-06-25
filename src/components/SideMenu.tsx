import { useEffect } from 'react';
import type { TabKey } from './Tabs';

interface SideMenuProps {
  isOpen: boolean;
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
  onClose: () => void;
}

const menuItems: Array<{ key: TabKey; label: string; description: string }> = [
  { key: 'excel', label: 'Vista Excel', description: 'Comparacion de filas y fechas del Planner.' },
  { key: 'planner', label: 'Planner', description: 'Vista tipo tablero de la planificacion actual.' },
  { key: 'grid', label: 'Grid', description: 'Seleccion y revision operativa de cambios.' },
  { key: 'calendar', label: 'Calendario', description: 'Calendario de fechas planificadas y reales.' },
  { key: 'master', label: 'Maestro', description: 'Edicion manual del Excel maestro interno.' },
  {
    key: 'tracking',
    label: 'Visualizador Seguimiento de Proyectos',
    description: 'Vista dedicada de la hoja Seguimiento Proyectos del maestro.',
  },
];

export function SideMenu({ isOpen, activeTab, onSelect, onClose }: SideMenuProps) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="side-menu-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="side-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegacion"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Actualizador Planner</span>
            <h2>Menu</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Cerrar menu" onClick={onClose}>
            x
          </button>
        </header>

        <nav aria-label="Secciones">
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activeTab === item.key ? 'is-active' : undefined}
              onClick={() => {
                onSelect(item.key);
                onClose();
              }}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
}
