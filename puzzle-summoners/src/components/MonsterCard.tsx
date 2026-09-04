import type { MonsterDef } from '../game/types'
import { ELEMENT_META, RARITY_STAR_COLOR } from '../game/orbTheme'

interface MonsterCardProps {
  readonly def: MonsterDef
  readonly selected?: boolean
  readonly onClick?: () => void
  readonly badge?: string
}

export const MonsterCard = ({ def, selected, onClick, badge }: MonsterCardProps) => {
  const meta = ELEMENT_META[def.element]
  const starColor = RARITY_STAR_COLOR[def.rarity]

  return (
    <button
      type="button"
      className={`monster-card${selected ? ' monster-card--selected' : ''}${onClick ? '' : ' monster-card--static'}`}
      onClick={onClick}
      style={{ borderColor: starColor }}
    >
      {badge && <span className="monster-card-badge">{badge}</span>}
      <div className="monster-card-portrait" style={{ background: meta.color }}>
        {meta.icon}
      </div>
      <div className="monster-card-stars" style={{ color: starColor }}>
        {'★'.repeat(def.rarity)}
      </div>
      <div className="monster-card-name">{def.name}</div>
      <div className="monster-card-stats">
        HP{def.baseHp} / ATK{def.baseAtk} / RCV{def.baseRcv}
      </div>
    </button>
  )
}
