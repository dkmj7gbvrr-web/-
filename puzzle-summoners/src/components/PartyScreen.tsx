import { useMemo, useState } from 'react'
import { computeTeamStats } from '../game/battle'
import { ELEMENT_META } from '../game/orbTheme'
import type { OwnedMonsterWithDef } from '../hooks/useGameState'
import { MonsterCard } from './MonsterCard'

interface PartyScreenProps {
  readonly partySlots: readonly (OwnedMonsterWithDef | null)[]
  readonly ownedMonsters: readonly OwnedMonsterWithDef[]
  readonly onSetSlot: (slotIndex: number, uid: string | null) => void
}

export const PartyScreen = ({ partySlots, ownedMonsters, onSetSlot }: PartyScreenProps) => {
  const [selectedSlot, setSelectedSlot] = useState(0)

  const team = useMemo(
    () => computeTeamStats(partySlots.filter((m): m is OwnedMonsterWithDef => m !== null).map((m) => m.def)),
    [partySlots],
  )

  const handleSlotClick = (index: number) => {
    if (partySlots[index]) {
      onSetSlot(index, null)
      return
    }
    setSelectedSlot(index)
  }

  const handlePickMonster = (uid: string) => {
    onSetSlot(selectedSlot, uid)
    const nextEmpty = partySlots.findIndex((m, i) => i !== selectedSlot && m === null)
    if (nextEmpty >= 0) setSelectedSlot(nextEmpty)
  }

  return (
    <div className="screen">
      <h2>パーティ編成</h2>
      <p className="screen-lead">先頭（左端）がリーダー。空き枠を選んでから下のモンスターをタップして編成しよう。</p>

      <div className="party-slots">
        {partySlots.map((member, index) => (
          <div
            key={index}
            className={`party-slot${index === selectedSlot ? ' party-slot--selected' : ''}${index === 0 ? ' party-slot--leader' : ''}`}
            onClick={() => handleSlotClick(index)}
          >
            {index === 0 && <span className="party-slot-tag">LEADER</span>}
            {member ? (
              <MonsterCard def={member.def} />
            ) : (
              <div className="party-slot-empty">＋</div>
            )}
          </div>
        ))}
      </div>

      <div className="team-stats-preview">
        <h3>チームステータス</h3>
        <p>最大HP: {Math.round(team.maxHp)} / RCV: {Math.round(team.rcv)}</p>
        <div className="team-atk-breakdown">
          {(Object.keys(team.atkByElement) as (keyof typeof team.atkByElement)[]).map((el) => (
            <span key={el} className="atk-chip">
              {ELEMENT_META[el].icon} {Math.round(team.atkByElement[el])}
            </span>
          ))}
        </div>
      </div>

      <h3>所持モンスター</h3>
      <div className="monster-grid">
        {ownedMonsters.map((m) => (
          <MonsterCard key={m.uid} def={m.def} onClick={() => handlePickMonster(m.uid)} />
        ))}
      </div>
    </div>
  )
}
