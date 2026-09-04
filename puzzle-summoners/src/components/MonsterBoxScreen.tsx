import { useMemo } from 'react'
import type { OwnedMonsterWithDef } from '../hooks/useGameState'
import { MonsterCard } from './MonsterCard'

interface MonsterBoxScreenProps {
  readonly ownedMonsters: readonly OwnedMonsterWithDef[]
}

export const MonsterBoxScreen = ({ ownedMonsters }: MonsterBoxScreenProps) => {
  const grouped = useMemo(() => {
    const map = new Map<string, { def: OwnedMonsterWithDef['def']; count: number }>()
    for (const owned of ownedMonsters) {
      const entry = map.get(owned.defId)
      if (entry) entry.count += 1
      else map.set(owned.defId, { def: owned.def, count: 1 })
    }
    return [...map.values()].sort((a, b) => b.def.rarity - a.def.rarity || a.def.name.localeCompare(b.def.name, 'ja'))
  }, [ownedMonsters])

  return (
    <div className="screen">
      <h2>モンスターボックス</h2>
      <p className="screen-lead">所持数: {ownedMonsters.length}体（図鑑: {grouped.length}種類）</p>
      <div className="monster-grid">
        {grouped.map(({ def, count }) => (
          <MonsterCard key={def.id} def={def} badge={count > 1 ? `×${count}` : undefined} />
        ))}
      </div>
    </div>
  )
}
