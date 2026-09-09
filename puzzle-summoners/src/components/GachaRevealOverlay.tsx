import { useEffect, useRef, useState } from 'react'
import { withCssVar } from '../game/cssVar'
import { TELL_LABEL, compareTellTier, rollTellTier } from '../game/gachaTell'
import type { TellTier } from '../game/gachaTell'
import type { PullRecord } from '../game/gacha'
import { EGG_TIER_THEME, RARITY_STAR_COLOR, initialEggTier } from '../game/orbTheme'
import type { EggTier } from '../game/orbTheme'
import { mulberry32, randomSeed } from '../game/rng'
import {
  playBigWinFanfare,
  playEggCrack,
  playEggUpgrade,
  playGachaChime,
  playMissThud,
  playOmenPokyuun,
  playReversalSting,
} from '../game/sound'
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

type CrackPhase = 'shake' | 'miss' | 'reversal' | 'upgrade' | null

interface BigWinBanner {
  readonly id: number
  readonly tellTier: TellTier
  readonly pityTriggered: boolean
}

const bannerLabel = (banner: BigWinBanner): string => {
  if (banner.pityTriggered) return '天井到達！5★以上確定！！'
  return banner.tellTier === 'legend' ? 'LEGEND…！？' : '激アツ…！？'
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const GachaRevealOverlay = ({ pulls, onClose }: GachaRevealOverlayProps) => {
  // 「見せかけの期待度」を演出専用の乱数で決める。本家パチンコの信頼度と同じく、
  // ここで高い期待度が出ても実際に高レアが出るとは限らないし、逆に低い期待度のまま
  // 高レアが出ることもある（実際の抽選結果=pulls自体には一切影響しない）
  const [tellTiers] = useState<readonly TellTier[]>(() => {
    const rng = mulberry32(randomSeed())
    return pulls.map((p) => rollTellTier(rng, p.monster.rarity))
  })
  const maxTellTierRef = useRef(tellTiers.reduce<TellTier>((max, t) => (compareTellTier(t, max) > 0 ? t : max), 'low'))
  const hasBigHitRef = useRef(compareTellTier(maxTellTierRef.current, 'high') >= 0)

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

  // 「先バレ」演出：見せかけの期待度がhigh以上のときだけ、開封の最初に一度だけ予兆を挟む。
  // これも見せかけなので、実際には並程度の結果に終わることもある
  useEffect(() => {
    if (!hasBigHitRef.current) return
    playOmenPokyuun(maxTellTierRef.current === 'legend' ? 'legend' : 'high')
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
    const tellTier = tellTiers[index]
    // 天井（pityTriggered）は演出のガセとは違い、本当に5★以上が保証された事実なので、
    // 見せかけの期待度roll次第に関わらず必ずリーチ演出を通す
    const isHypeReach = compareTellTier(tellTier, 'high') >= 0 || pulls[index].pityTriggered

    setActiveIndex(index)
    setPhase('shake')
    await sleep(SHAKE_MS)
    if (cancelled()) return

    if (isHypeReach) {
      // 「外れたと思ったらあたり」：一度しょぼんと落胆させてから逆転で盛り上げる。
      // ここで煽った期待度は演出上のものなので、この後の卵割りが並の結果に終わることもある
      setPhase('miss')
      playMissThud()
      await sleep(MISS_MS)
      if (cancelled()) return

      setPhase('reversal')
      playReversalSting()
      playBigWinFanfare(tellTier === 'legend' ? 6 : 5)
      setBigWin({ id: myToken, tellTier, pityTriggered: pulls[index].pityTriggered })
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
        <div
          key={bigWin.id}
          className={`gacha-bigwin-banner gacha-bigwin-banner--tier${bigWin.tellTier === 'legend' ? 6 : 5}`}
        >
          {bannerLabel(bigWin)}
        </div>
      )}

      <div className="gacha-reveal-grid" onClick={(event) => event.stopPropagation()}>
        {pulls.map((pull, index) => {
          const revealed = index < revealedCount
          const isActive = index === activeIndex
          const tellTier = tellTiers[index]

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
              ? `gacha-hold-lamp gacha-hold-lamp--locked gacha-hold-lamp--${phase === 'miss' ? 'low' : tellTier}`
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
              {isActive && phase === 'shake' && TELL_LABEL[tellTier] && (
                <span className={`gacha-expect-text gacha-expect-text--${tellTier}`}>{TELL_LABEL[tellTier]}</span>
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
