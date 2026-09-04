import { useEffect, useRef, useState } from 'react'
import type { PullRecord } from '../game/gacha'
import { withCssVar } from '../game/cssVar'
import { EGG_THEME, RARITY_STAR_COLOR } from '../game/orbTheme'
import { playBigWinFanfare, playEggCrack, playGachaChime } from '../game/sound'
import { MonsterCard } from './MonsterCard'

interface GachaRevealOverlayProps {
  readonly pulls: readonly PullRecord[]
  readonly onClose: () => void
}

const SHAKE_MS = 280
const BIG_WIN_LABEL: Partial<Record<number, string>> = {
  5: '激レア確定！！',
  6: 'LEGEND!!!',
}

interface BigWinBanner {
  readonly id: number
  readonly rarity: number
}

export const GachaRevealOverlay = ({ pulls, onClose }: GachaRevealOverlayProps) => {
  const [revealedCount, setRevealedCount] = useState(0)
  const [crackingIndex, setCrackingIndex] = useState<number | null>(null)
  const [bigWin, setBigWin] = useState<BigWinBanner | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const bigWinIdRef = useRef(0)

  const isDone = revealedCount >= pulls.length

  const startCrack = () => {
    if (revealedCount >= pulls.length || crackingIndex !== null) return
    const index = revealedCount
    setCrackingIndex(index)
    const id = window.setTimeout(() => {
      const rarity = pulls[index].monster.rarity
      playEggCrack(rarity)
      playGachaChime(rarity)
      if (rarity >= 5) {
        playBigWinFanfare(rarity)
        bigWinIdRef.current += 1
        setBigWin({ id: bigWinIdRef.current, rarity })
      }
      setCrackingIndex(null)
      setRevealedCount(index + 1)
    }, SHAKE_MS)
    timeoutRef.current = id
  }

  useEffect(() => {
    if (isDone || crackingIndex !== null) return
    const upcomingRarity = pulls[revealedCount].monster.rarity
    const delay = revealedCount === 0 ? 500 : 550 + upcomingRarity * 130
    const id = window.setTimeout(startCrack, delay)
    timeoutRef.current = id
    return () => window.clearTimeout(id)
    // startCrackはこのレンダーのrevealedCountに紐づくクロージャなので依存配列に含める必要はない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedCount, crackingIndex, isDone, pulls])

  const handleTap = () => {
    if (crackingIndex !== null) return
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    startCrack()
  }

  const handleSkip = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    setCrackingIndex(null)
    setRevealedCount(pulls.length)
  }

  const highestRevealedRarity = pulls.slice(0, revealedCount).reduce((max, p) => Math.max(max, p.monster.rarity), 0)

  return (
    <div className="gacha-reveal-overlay" onClick={isDone ? undefined : handleTap}>
      {highestRevealedRarity >= 5 && (
        <div
          key={highestRevealedRarity}
          className="gacha-flash"
          style={withCssVar('--flash-color', RARITY_STAR_COLOR[highestRevealedRarity])}
        />
      )}

      {bigWin && (
        <div key={bigWin.id} className={`gacha-bigwin-banner gacha-bigwin-banner--tier${bigWin.rarity}`}>
          {BIG_WIN_LABEL[bigWin.rarity]}
        </div>
      )}

      <div className="gacha-reveal-grid" onClick={(event) => event.stopPropagation()}>
        {pulls.map((pull, index) => {
          const revealed = index < revealedCount
          const isCracking = index === crackingIndex
          const egg = EGG_THEME[pull.monster.rarity]

          return (
            <div key={index} className="gacha-reveal-slot" style={{ animationDelay: `${Math.min(index, 9) * 70}ms` }}>
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
                <button
                  type="button"
                  className={`gacha-egg${egg.shimmer ? ' gacha-egg--shimmer' : ''}${isCracking ? ' gacha-egg--shaking' : ''}`}
                  onClick={handleTap}
                  aria-label="タップして卵を割る"
                  style={{ ...withCssVar('--egg-gradient', egg.gradient), ...withCssVar('--egg-glow', egg.glow) }}
                />
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
