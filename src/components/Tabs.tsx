export type TabKey = 'excel' | 'planner' | 'grid' | 'calendar' | 'master';

interface TabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'excel', label: 'Vista Excel', icon: '▦' },
  { key: 'planner', label: 'Planner', icon: '□' },
  { key: 'grid', label: 'Grid', icon: '☷' },
  { key: 'calendar', label: 'Calendario', icon: '◷' },
  { key: 'master', label: 'Maestro', icon: '✓' },
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
