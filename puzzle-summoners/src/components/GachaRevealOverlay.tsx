import { useEffect, useRef, useState } from 'react'
import { withCssVar } from '../game/cssVar'
import { buildFlickerPlan } from '../game/gachaFlicker'
import type { PullRecord } from '../game/gacha'
import { EGG_THEME, NEUTRAL_EGG_THEME, RARITY_STAR_COLOR } from '../game/orbTheme'
import { mulberry32, randomSeed } from '../game/rng'
import { playBigWinFanfare, playEggCrack, playFlickerTick, playGachaChime, playTensionRise } from '../game/sound'
import type { Rarity } from '../game/types'
import { MonsterCard } from './MonsterCard'

interface GachaRevealOverlayProps {
  readonly pulls: readonly PullRecord[]
  readonly onClose: () => void
}

const SHAKE_MS = 260
const AUTO_ADVANCE_MS = 320
const BIG_WIN_LABEL: Partial<Record<Rarity, string>> = {
  5: '激レア確定！！',
  6: 'LEGEND!!!',
}

interface BigWinBanner {
  readonly id: number
  readonly rarity: Rarity
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const GachaRevealOverlay = ({ pulls, onClose }: GachaRevealOverlayProps) => {
  const [revealedCount, setRevealedCount] = useState(0)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [phase, setPhase] = useState<'flicker' | 'shake' | null>(null)
  const [flickerRarity, setFlickerRarity] = useState<Rarity>(1)
  const [bigWin, setBigWin] = useState<BigWinBanner | null>(null)

  const rngRef = useRef(mulberry32(randomSeed()))
  const advanceTimeoutRef = useRef<number | null>(null)
  const sequenceTokenRef = useRef(0)

  const isDone = revealedCount >= pulls.length

  const startCrack = async (index: number) => {
    if (index >= pulls.length || activeIndex !== null) return
    const myToken = ++sequenceTokenRef.current
    const cancelled = () => sequenceTokenRef.current !== myToken

    const finalRarity = pulls[index].monster.rarity
    const plan = buildFlickerPlan(finalRarity, rngRef.current)

    setActiveIndex(index)
    setPhase('flicker')

    for (let i = 0; i < plan.length; i++) {
      if (cancelled()) return
      const step = plan[i]
      setFlickerRarity(step.rarity)
      playFlickerTick(i / Math.max(1, plan.length - 1), step.isLock)
      if (finalRarity >= 4 && i === plan.length - 2) {
        playTensionRise((step.holdMs + plan[plan.length - 1].holdMs) / 1000)
      }
      await sleep(step.holdMs)
      if (cancelled()) return
    }

    setPhase('shake')
    await sleep(SHAKE_MS)
    if (cancelled()) return

    playEggCrack(finalRarity)
    playGachaChime(finalRarity)
    if (finalRarity >= 5) {
      playBigWinFanfare(finalRarity)
      setBigWin({ id: myToken, rarity: finalRarity })
    }

    setActiveIndex(null)
    setPhase(null)
    setRevealedCount(index + 1)
  }

  useEffect(() => {
    if (isDone || activeIndex !== null) return
    const id = window.setTimeout(() => {
      void startCrack(revealedCount)
    }, revealedCount === 0 ? 450 : AUTO_ADVANCE_MS)
    advanceTimeoutRef.current = id
    return () => window.clearTimeout(id)
    // startCrackはこのレンダーのrevealedCount/pullsに紐づくクロージャなので依存配列に含める必要はない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedCount, activeIndex, isDone])

  const handleTap = () => {
    if (activeIndex !== null || isDone) return
    if (advanceTimeoutRef.current !== null) window.clearTimeout(advanceTimeoutRef.current)
    void startCrack(revealedCount)
  }

  const handleSkip = () => {
    sequenceTokenRef.current += 1
    if (advanceTimeoutRef.current !== null) window.clearTimeout(advanceTimeoutRef.current)
    setActiveIndex(null)
    setPhase(null)
    setBigWin(null)
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
          const isActive = index === activeIndex

          if (revealed) {
            return (
              <div key={index} className="gacha-reveal-slot" style={{ animationDelay: `${Math.min(index, 9) * 70}ms` }}>
                <div
                  className={`gacha-reveal-card${pull.monster.rarity >= 5 ? ' gacha-reveal-card--burst' : ''}`}
                  style={withCssVar('--burst-color', RARITY_STAR_COLOR[pull.monster.rarity])}
                >
                  <MonsterCard
                    def={pull.monster}
                    badge={pull.pityTriggered ? '天井' : pull.monster.rarity >= 5 ? 'PICKUP' : undefined}
                  />
                </div>
              </div>
            )
          }

          const egg = isActive ? EGG_THEME[flickerRarity] : NEUTRAL_EGG_THEME
          const eggClass = [
            'gacha-egg',
            egg.shimmer ? 'gacha-egg--shimmer' : '',
            isActive && phase === 'flicker' ? 'gacha-egg--flickering' : '',
            isActive && phase === 'shake' ? 'gacha-egg--shaking' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div key={index} className="gacha-reveal-slot" style={{ animationDelay: `${Math.min(index, 9) * 70}ms` }}>
              <button
                type="button"
                className={eggClass}
                onClick={handleTap}
                aria-label="タップして卵を割る"
                style={{ ...withCssVar('--egg-gradient', egg.gradient), ...withCssVar('--egg-glow', egg.glow) }}
              />
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
