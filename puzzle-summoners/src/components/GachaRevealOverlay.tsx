import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { PullRecord } from '../game/gacha'
import { RARITY_STAR_COLOR } from '../game/orbTheme'
import { playGachaChime } from '../game/sound'
import { MonsterCard } from './MonsterCard'

interface GachaRevealOverlayProps {
  readonly pulls: readonly PullRecord[]
  readonly onClose: () => void
}

const withCssVar = (name: string, value: string): CSSProperties => ({ [name]: value }) as CSSProperties

export const GachaRevealOverlay = ({ pulls, onClose }: GachaRevealOverlayProps) => {
  const [revealedCount, setRevealedCount] = useState(0)
  const timeoutRef = useRef<number | null>(null)

  const isDone = revealedCount >= pulls.length

  const revealNext = () => {
    if (revealedCount >= pulls.length) return
    playGachaChime(pulls[revealedCount].monster.rarity)
    setRevealedCount((count) => count + 1)
  }

  useEffect(() => {
    if (isDone) return
    const upcomingRarity = pulls[revealedCount].monster.rarity
    const delay = revealedCount === 0 ? 350 : 550 + upcomingRarity * 130
    const id = window.setTimeout(revealNext, delay)
    timeoutRef.current = id
    return () => window.clearTimeout(id)
    // revealNextはこのレンダーのrevealedCountに紐づくクロージャなので依存配列に含める必要はない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedCount, isDone, pulls])

  const handleTap = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    revealNext()
  }

  const handleSkip = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    setRevealedCount(pulls.length)
  }

  const highestRevealedRarity = pulls.slice(0, revealedCount).reduce((max, p) => Math.max(max, p.monster.rarity), 0)

  return (
    <div className="gacha-reveal-overlay" onClick={isDone ? undefined : handleTap}>
      {highestRevealedRarity >= 5 && (
        <div key={highestRevealedRarity} className="gacha-flash" style={withCssVar('--flash-color', RARITY_STAR_COLOR[highestRevealedRarity])} />
      )}

      <div className="gacha-reveal-grid" onClick={(event) => event.stopPropagation()}>
        {pulls.map((pull, index) => {
          const revealed = index < revealedCount
          return (
            <div key={index} className="gacha-reveal-slot">
              {revealed ? (
                <div
                  className={`gacha-reveal-card${pull.monster.rarity >= 5 ? ' gacha-reveal-card--burst' : ''}`}
                  style={withCssVar('--burst-color', RARITY_STAR_COLOR[pull.monster.rarity])}
                >
                  <MonsterCard
                    def={pull.monster}
                    badge={pull.pityTriggered ? '天井' : pull.monster.rarity >= 5 ? 'PICKUP' : undefined}
                  />
                </div>
              ) : (
                <button type="button" className="gacha-mystery-card" onClick={handleTap} aria-label="タップして結果を表示">
                  <span>?</span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="gacha-reveal-footer" onClick={(event) => event.stopPropagation()}>
        {!isDone && (
          <button type="button" className="ghost-button" onClick={handleSkip}>
            すべて表示
          </button>
        )}
        {isDone && (
          <button type="button" className="primary-button primary-button--gold" onClick={onClose}>
            OK
          </button>
        )}
      </div>
    </div>
  )
}
