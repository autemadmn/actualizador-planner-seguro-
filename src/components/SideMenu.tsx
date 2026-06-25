import { useEffect } from 'react';
import type { TabKey } from './Tabs';

interface SideMenuProps {
  isOpen: boolean;
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
  onClose: () => void;
}

interface MenuItem {
  key: TabKey;
  label: string;
  description: string;
}

const menuSections: Array<{ title: string; items: MenuItem[] }> = [
  {
    title: 'Comparacion Planner',
    items: [
      { key: 'excel', label: 'Vista Excel', description: 'Comparacion de filas y fechas del Planner.' },
      { key: 'planner', label: 'Planner', description: 'Tablero de la planificacion actual.' },
      { key: 'grid', label: 'Grid', description: 'Seleccion y revision operativa de cambios.' },
      { key: 'calendar', label: 'Calendario', description: 'Calendario de fechas planificadas y reales.' },
      { key: 'master', label: 'Maestro', description: 'Edicion manual del Excel maestro interno.' },
    ],
  },
  {
    title: 'Seguimiento Proyectos',
    items: [
      {
        key: 'tracking-excel',
        label: 'Excel Seguimiento',
        description: 'Tabla filtrable de la hoja Seguimiento Proyectos.',
      },
      {
        key: 'tracking-planner',
        label: 'Planner Seguimiento',
        description: 'Tablero por entregables y responsables de Seguimiento.',
      },
      {
        key: 'tracking-grid',
        label: 'Grid Seguimiento',
        description: 'Vista de revision rapida solo con filas de Seguimiento.',
      },
      {
        key: 'tracking-calendar',
        label: 'Calendario Seguimiento',
        description: 'Calendario de deadlines y publicaciones de Seguimiento.',
      },
    ],
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
          {menuSections.map((section) => (
            <section className="side-menu-section" key={section.title}>
              <h3>{section.title}</h3>
              {section.items.map((item) => (
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
            </section>
          ))}
        </nav>
      </aside>
    </div>
  );
}
