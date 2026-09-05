import { useMemo, useState } from 'react'
import type { OwnedMonsterWithDef } from '../hooks/useGameState'
import { withCssVar } from '../game/cssVar'
import { ELEMENTS } from '../game/types'
import type { AttackElement, MonsterDef } from '../game/types'
import { ELEMENT_META } from '../game/orbTheme'
import { MonsterCard } from './MonsterCard'

interface MonsterBoxScreenProps {
  readonly ownedMonsters: readonly OwnedMonsterWithDef[]
}

type ElementFilter = 'all' | AttackElement
type SortKey = 'rarity' | 'name' | 'element' | 'atk' | 'hp'

const SORT_LABEL: Record<SortKey, string> = {
  rarity: 'レア度順',
  name: '名前順',
  element: '属性順',
  atk: 'ATK順',
  hp: 'HP順',
}

const sortEntries = (entries: readonly { def: MonsterDef; count: number }[], sortKey: SortKey) => {
  const sorted = [...entries]
  switch (sortKey) {
    case 'rarity':
      sorted.sort((a, b) => b.def.rarity - a.def.rarity || a.def.name.localeCompare(b.def.name, 'ja'))
      break
    case 'name':
      sorted.sort((a, b) => a.def.name.localeCompare(b.def.name, 'ja'))
      break
    case 'element':
      sorted.sort((a, b) => ELEMENTS.indexOf(a.def.element) - ELEMENTS.indexOf(b.def.element) || b.def.rarity - a.def.rarity)
      break
    case 'atk':
      sorted.sort((a, b) => b.def.baseAtk - a.def.baseAtk)
      break
    case 'hp':
      sorted.sort((a, b) => b.def.baseHp - a.def.baseHp)
      break
  }
  return sorted
}

export const MonsterBoxScreen = ({ ownedMonsters }: MonsterBoxScreenProps) => {
  const [elementFilter, setElementFilter] = useState<ElementFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('rarity')

  const grouped = useMemo(() => {
    const map = new Map<string, { def: OwnedMonsterWithDef['def']; count: number }>()
    for (const owned of ownedMonsters) {
      const entry = map.get(owned.defId)
      if (entry) entry.count += 1
      else map.set(owned.defId, { def: owned.def, count: 1 })
    }
    return [...map.values()]
  }, [ownedMonsters])

  const filtered = useMemo(
    () => (elementFilter === 'all' ? grouped : grouped.filter((g) => g.def.element === elementFilter)),
    [grouped, elementFilter],
  )

  const sorted = useMemo(() => sortEntries(filtered, sortKey), [filtered, sortKey])

  return (
    <div className="screen">
      <h2>モンスターボックス</h2>
      <p className="screen-lead">
        所持数: {ownedMonsters.length}体（図鑑: {grouped.length}種類）
      </p>

      <div className="box-filter-row">
        <button
          type="button"
          className={`box-filter-chip${elementFilter === 'all' ? ' is-active' : ''}`}
          onClick={() => setElementFilter('all')}
        >
          すべて
        </button>
        {ELEMENTS.map((el) => (
          <button
            key={el}
            type="button"
            className={`box-filter-chip${elementFilter === el ? ' is-active' : ''}`}
            style={withCssVar('--chip-color', ELEMENT_META[el].color)}
            onClick={() => setElementFilter(el)}
            aria-label={`${ELEMENT_META[el].label}属性で絞り込む`}
          >
            {ELEMENT_META[el].icon}
          </button>
        ))}

        <select
          className="box-sort-select"
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as SortKey)}
          aria-label="並び替え"
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {SORT_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      {sorted.length === 0 ? (
        <p className="screen-lead">該当するモンスターがいません。</p>
      ) : (
        <div className="monster-grid monster-grid--detailed">
          {sorted.map(({ def, count }) => (
            <MonsterCard key={def.id} def={def} badge={count > 1 ? `×${count}` : undefined} showSkills />
          ))}
        </div>
      )}
    </div>
  )
}
