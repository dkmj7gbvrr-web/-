export type TabId = 'home' | 'gacha' | 'box' | 'party' | 'stage'

interface TabDef {
  readonly id: TabId
  readonly label: string
  readonly icon: string
}

const TABS: readonly TabDef[] = [
  { id: 'home', label: 'ホーム', icon: '🏠' },
  { id: 'gacha', label: 'ガチャ', icon: '🎰' },
  { id: 'box', label: 'ボックス', icon: '📦' },
  { id: 'party', label: '編成', icon: '🛡️' },
  { id: 'stage', label: 'ダンジョン', icon: '🗺️' },
]

interface TabBarProps {
  readonly active: TabId
  readonly onChange: (tab: TabId) => void
}

export const TabBar = ({ active, onChange }: TabBarProps) => {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab-bar-item${active === tab.id ? ' tab-bar-item--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="tab-bar-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
