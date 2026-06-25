export type TabKey =
  | 'excel'
  | 'planner'
  | 'grid'
  | 'calendar'
  | 'master'
  | 'tracking-excel'
  | 'tracking-planner'
  | 'tracking-grid'
  | 'tracking-calendar';

interface TabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'excel', label: 'Vista Excel', icon: 'XL' },
  { key: 'planner', label: 'Planner', icon: 'PL' },
  { key: 'grid', label: 'Grid', icon: 'GR' },
  { key: 'calendar', label: 'Calendario', icon: 'CA' },
  { key: 'master', label: 'Maestro', icon: 'MA' },
  { key: 'tracking-excel', label: 'Excel Seguimiento', icon: 'SE' },
  { key: 'tracking-planner', label: 'Planner Seguimiento', icon: 'SP' },
  { key: 'tracking-grid', label: 'Grid Seguimiento', icon: 'SG' },
  { key: 'tracking-calendar', label: 'Calendario Seguimiento', icon: 'SC' },
];

export function Tabs({ activeTab, onTabChange }: TabsProps) {
  return (
    <nav className="tabs" aria-label="Vistas de trabajo">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={activeTab === tab.key ? 'active' : undefined}
          onClick={() => onTabChange(tab.key)}
        >
          <span aria-hidden="true">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
