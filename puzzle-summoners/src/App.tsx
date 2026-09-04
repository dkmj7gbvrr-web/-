import { useState } from 'react'
import './App.css'
import { useGameState } from './hooks/useGameState'
import type { Stage } from './game/types'
import { TabBar } from './components/TabBar'
import type { TabId } from './components/TabBar'
import { HomeScreen } from './components/HomeScreen'
import { GachaScreen } from './components/GachaScreen'
import { MonsterBoxScreen } from './components/MonsterBoxScreen'
import { PartyScreen } from './components/PartyScreen'
import { StageSelectScreen } from './components/StageSelectScreen'
import { BattleScreen } from './components/BattleScreen'

function App() {
  const game = useGameState()
  const [tab, setTab] = useState<TabId>('home')
  const [activeStage, setActiveStage] = useState<Stage | null>(null)

  if (activeStage) {
    return (
      <BattleScreen
        stage={activeStage}
        partyMonsterDefs={game.partyMonsterDefs}
        onFinish={(victory) => game.completeStage(activeStage, victory)}
        onExit={() => setActiveStage(null)}
      />
    )
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        {tab === 'home' && (
          <HomeScreen
            stones={game.player.stones}
            coins={game.player.coins}
            ownedCount={game.ownedMonsters.length}
            clearedCount={game.player.clearedStageIds.length}
            onNavigate={setTab}
          />
        )}
        {tab === 'gacha' && (
          <GachaScreen
            stones={game.player.stones}
            singleCost={game.singlePullCost}
            multiCost={game.multiPullCost}
            pullsSincePity={game.player.pullCountSinceRare}
            onPullSingle={game.pullSingle}
            onPullMulti={game.pullMulti}
          />
        )}
        {tab === 'box' && <MonsterBoxScreen ownedMonsters={game.ownedMonsters} />}
        {tab === 'party' && (
          <PartyScreen partySlots={game.partySlots} ownedMonsters={game.ownedMonsters} onSetSlot={game.setPartySlot} />
        )}
        {tab === 'stage' && (
          <StageSelectScreen
            isStageCleared={game.isStageCleared}
            canBattle={game.partyMonsterDefs.length > 0}
            onSelectStage={setActiveStage}
          />
        )}
      </div>
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}

export default App
