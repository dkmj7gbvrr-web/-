import { useEffect, useState } from 'react'
import { withCssVar } from '../game/cssVar'
import type { PullRecord } from '../game/gacha'
import { RARITY_STAR_COLOR } from '../game/orbTheme'
import { playBigWinFanfare, playReelStop, playTensionRise } from '../game/sound'
import type { Rarity } from '../game/types'

interface GachaReelTeaserProps {
  readonly pulls: readonly PullRecord[]
  readonly onDone: () => void
}

const TEASER_BANNER_LABEL: Partial<Record<Rarity, string>> = {
  4: 'レア確定！',
  5: '激レア確定！！',
  6: 'LEGEND!!!',
}

interface TierTiming {
  readonly reel1: number
  readonly reel2: number
  readonly reel3: number
  readonly holdAfter: number
}

const TIMING_BY_TIER: Record<Rarity, TierTiming> = {
  1: { reel1: 180, reel2: 320, reel3: 460, holdAfter: 220 },
  2: { reel1: 180, reel2: 320, reel3: 460, holdAfter: 220 },
  3: { reel1: 200, reel2: 360, reel3: 520, holdAfter: 260 },
  4: { reel1: 300, reel2: 560, reel3: 980, holdAfter: 750 },
  5: { reel1: 320, reel2: 660, reel3: 1300, holdAfter: 950 },
  6: { reel1: 350, reel2: 760, reel3: 1650, holdAfter: 1250 },
}

/** ガチャのレバーを引いた直後に表示する、スロットのリーチ演出を模したティザー */
export const GachaReelTeaser = ({ pulls, onDone }: GachaReelTeaserProps) => {
  const maxRarity = pulls.reduce<number>((max, p) => Math.max(max, p.monster.rarity), 1) as Rarity
  const [stoppedReels, setStoppedReels] = useState(0)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const timing = TIMING_BY_TIER[maxRarity]
    const timeouts: number[] = []
    const schedule = (fn: () => void, ms: number) => {
      timeouts.push(window.setTimeout(fn, ms))
    }

    schedule(() => {
      setStoppedReels(1)
      playReelStop(0)
    }, timing.reel1)

    schedule(() => {
      setStoppedReels(2)
      playReelStop(1)
      if (maxRarity >= 4) playTensionRise((timing.reel3 - timing.reel2) / 1000)
    }, timing.reel2)

    schedule(() => {
      setStoppedReels(3)
      playReelStop(2)
      if (maxRarity >= 4) {
        playBigWinFanfare(maxRarity)
        setShowBanner(true)
      }
    }, timing.reel3)

    schedule(onDone, timing.reel3 + timing.holdAfter)

    return () => timeouts.forEach((id) => window.clearTimeout(id))
    // 演出のタイミングはマウント時に決まるpulls/maxRarityにのみ依存する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reelColor = RARITY_STAR_COLOR[maxRarity]

  return (
    <div className="gacha-reveal-overlay gacha-reel-teaser">
      <p className="gacha-reel-teaser-lead">召喚中…</p>
      <div className="gacha-reel-row">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`gacha-reel${stoppedReels > i ? ' gacha-reel--stopped' : ''}`}>
            {stoppedReels > i ? (
              <span className="gacha-reel-symbol" style={withCssVar('--reel-color', reelColor)} />
            ) : (
              <div className="gacha-reel-strip" />
            )}
          </div>
        ))}
      </div>
      {showBanner && (
        <div className={`gacha-bigwin-banner gacha-bigwin-banner--tier${maxRarity}`}>{TEASER_BANNER_LABEL[maxRarity]}</div>
      )}
    </div>
  )
}
