import { useEffect, useRef, useState } from 'react'
import { withCssVar } from '../game/cssVar'
import type { PullRecord } from '../game/gacha'
import { EGG_TIER_THEME, EXPECTATION_LABEL, RARITY_STAR_COLOR, expectationOf, initialEggTier } from '../game/orbTheme'
import type { EggTier, Expectation } from '../game/orbTheme'
import {
  playBigWinFanfare,
  playEggCrack,
  playEggUpgrade,
  playGachaChime,
  playMissThud,
  playOmenRumble,
  playReversalSting,
} from '../game/sound'
import type { Rarity } from '../game/types'
import { MonsterCard } from './MonsterCard'

interface GachaRevealOverlayProps {
  readonly pulls: readonly PullRecord[]
  readonly onClose: () => void
}

const SHAKE_MS = 320
const MISS_MS = 420
const REVERSAL_MS = 480
const UPGRADE_MS = 700
const AUTO_ADVANCE_MS = 320
const OMEN_MS = 950
const BIG_WIN_LABEL: Partial<Record<Rarity, string>> = {
  5: '激レア確定！！',
  6: 'LEGEND!!!',
}

type CrackPhase = 'shake' | 'miss' | 'reversal' | 'upgrade' | null

interface BigWinBanner {
  readonly id: number
  readonly rarity: Rarity
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const GachaRevealOverlay = ({ pulls, onClose }: GachaRevealOverlayProps) => {
  const hasBigHitRef = useRef(pulls.some((p) => p.monster.rarity >= 5))
  const omenTierRef = useRef<'high' | 'legend'>(pulls.some((p) => p.monster.rarity === 6) ? 'legend' : 'high')

  const [revealedCount, setRevealedCount] = useState(0)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [phase, setPhase] = useState<CrackPhase>(null)
  const [bigWin, setBigWin] = useState<BigWinBanner | null>(null)
  const [omenActive, setOmenActive] = useState(hasBigHitRef.current)
  const [introDone, setIntroDone] = useState(!hasBigHitRef.current)

  const advanceTimeoutRef = useRef<number | null>(null)
  const omenTimeoutRef = useRef<number | null>(null)
  const sequenceTokenRef = useRef(0)

  const isDone = revealedCount >= pulls.length

  // 「先バレ」演出：レア以上を含む結果のときだけ、開封の最初に一度だけ予兆を挟む。
  // 文字では何も明かさず、音の違い（レジェンド級だけ特別なきらめきが重なる）だけで格を伝える
  useEffect(() => {
    if (!hasBigHitRef.current) return
    playOmenRumble(omenTierRef.current)
    const id = window.setTimeout(() => {
      setOmenActive(false)
      setIntroDone(true)
    }, OMEN_MS)
    omenTimeoutRef.current = id
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startCrack = async (index: number) => {
    if (index >= pulls.length || activeIndex !== null) return
    const myToken = ++sequenceTokenRef.current
    const cancelled = () => sequenceTokenRef.current !== myToken

    const finalRarity = pulls[index].monster.rarity

    setActiveIndex(index)
    setPhase('shake')
    await sleep(SHAKE_MS)
    if (cancelled()) return

    if (finalRarity >= 5) {
      // 「外れたと思ったらあたり」：一度しょぼんと落胆させてから逆転で盛り上げる
      setPhase('miss')
      playMissThud()
      await sleep(MISS_MS)
      if (cancelled()) return

      setPhase('reversal')
      playReversalSting()
      // 「確定」バナーはまだ誰が出たか分からないこの逆転の瞬間に出す。
      // 実際にどのモンスターかはこのあとの卵割りで初めて明かされる、という順番にして
      // 「もう見えてるのに今更確定も何もない」とならないようにしている
      playBigWinFanfare(finalRarity)
      setBigWin({ id: myToken, rarity: finalRarity })
      await sleep(REVERSAL_MS)
      if (cancelled()) return
    }

    if (finalRarity === 6) {
      setPhase('upgrade')
      playEggUpgrade()
      await sleep(UPGRADE_MS)
      if (cancelled()) return
    }

    playEggCrack(finalRarity)
    playGachaChime(finalRarity)

    setActiveIndex(null)
    setPhase(null)
    setRevealedCount(index + 1)
  }

  useEffect(() => {
    if (isDone || activeIndex !== null || !introDone) return
    const id = window.setTimeout(
      () => {
        void startCrack(revealedCount)
      },
      revealedCount === 0 ? 450 : AUTO_ADVANCE_MS,
    )
    advanceTimeoutRef.current = id
    return () => window.clearTimeout(id)
    // startCrackはこのレンダーのrevealedCount/pullsに紐づくクロージャなので依存配列に含める必要はない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedCount, activeIndex, isDone, introDone])

  const handleTap = () => {
    if (omenActive) {
      if (omenTimeoutRef.current !== null) window.clearTimeout(omenTimeoutRef.current)
      setOmenActive(false)
      setIntroDone(true)
      return
    }
    if (activeIndex !== null || isDone || !introDone) return
    if (advanceTimeoutRef.current !== null) window.clearTimeout(advanceTimeoutRef.current)
    void startCrack(revealedCount)
  }

  const handleSkip = () => {
    if (omenTimeoutRef.current !== null) window.clearTimeout(omenTimeoutRef.current)
    setOmenActive(false)
    setIntroDone(true)
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
      {omenActive && (
        <div className="gacha-omen-overlay">
          <div className="gacha-omen-silhouette" />
        </div>
      )}

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
          const expectation: Expectation = expectationOf(pull.monster.rarity)

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

          const displayTier: EggTier = isActive && phase === 'upgrade' ? 'rainbow' : initialEggTier(pull.monster.rarity)
          const egg = EGG_TIER_THEME[displayTier]
          const eggClass = [
            'gacha-egg',
            egg.shimmer ? 'gacha-egg--shimmer' : '',
            isActive && phase === 'shake' ? 'gacha-egg--shaking' : '',
            isActive && phase === 'miss' ? 'gacha-egg--miss' : '',
            isActive && phase === 'reversal' ? 'gacha-egg--reversal' : '',
            isActive && phase === 'upgrade' ? 'gacha-egg--upgrading' : '',
          ]
            .filter(Boolean)
            .join(' ')

          const holdLampClass =
            isActive && (phase === 'shake' || phase === 'miss' || phase === 'reversal')
              ? `gacha-hold-lamp gacha-hold-lamp--locked gacha-hold-lamp--${phase === 'miss' ? 'low' : expectation}`
              : `gacha-hold-lamp gacha-hold-lamp--cycling`

          return (
            <div key={index} className="gacha-reveal-slot" style={{ animationDelay: `${Math.min(index, 9) * 70}ms` }}>
              <span className={holdLampClass} style={{ animationDelay: `${(index % 7) * 137}ms` }} />
              <button
                type="button"
                className={eggClass}
                onClick={handleTap}
                aria-label={`タップして${egg.label}を割る`}
                title={egg.label}
                style={{ ...withCssVar('--egg-gradient', egg.gradient), ...withCssVar('--egg-glow', egg.glow) }}
              />
              {isActive && phase === 'shake' && EXPECTATION_LABEL[expectation] && (
                <span className={`gacha-expect-text gacha-expect-text--${expectation}`}>
                  {EXPECTATION_LABEL[expectation]}
                </span>
              )}
              {isActive && phase === 'miss' && <span className="gacha-expect-text gacha-expect-text--low">…あれ？</span>}
              {isActive && phase === 'reversal' && (
                <span className="gacha-expect-text gacha-expect-text--legend">まさかの…！！</span>
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
