import { useState } from 'react'
import type { PullRecord } from '../game/gacha'
import { PITY_THRESHOLD } from '../game/gacha'
import { GachaLever } from './GachaLever'
import { GachaRevealOverlay } from './GachaRevealOverlay'

interface GachaScreenProps {
  readonly stones: number
  readonly singleCost: number
  readonly multiCost: number
  readonly pullsSincePity: number
  readonly onPullSingle: () => readonly PullRecord[] | null
  readonly onPullMulti: () => readonly PullRecord[] | null
  readonly onAddStones: (amount: number) => void
}

const STONE_REFILL_AMOUNT = 200

export const GachaScreen = ({
  stones,
  singleCost,
  multiCost,
  pullsSincePity,
  onPullSingle,
  onPullMulti,
  onAddStones,
}: GachaScreenProps) => {
  const [mode, setMode] = useState<1 | 10>(1)
  const [reveal, setReveal] = useState<readonly PullRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runPull = () => {
    setError(null)
    const fn = mode === 1 ? onPullSingle : onPullMulti
    const pulls = fn()
    if (!pulls) {
      setError('魔法石が足りません！')
      return
    }
    setReveal(pulls)
  }

  const cost = mode === 1 ? singleCost : multiCost
  const leverLabel = mode === 1 ? `召喚する（魔法石 ${singleCost}）` : `10連召喚する（魔法石 ${multiCost}）`

  return (
    <div className="screen gacha-screen">
      <h2>ガチャ召喚の間</h2>
      <div className="gacha-banner">
        <span className="gacha-banner-icon">🔮</span>
      </div>
      <p className="gacha-lead">魔法石を捧げて、新たな仲間モンスターを召喚しよう。レバーを引くと卵が出てくる！</p>
      <p className="gacha-pity">次の天井まであと{Math.max(0, PITY_THRESHOLD - pullsSincePity)}回（天井到達で5★以上確定）</p>

      <div className="gacha-stone-row">
        <span>
          魔法石 <span className="gacha-stone-count">💎 {stones}</span>
        </span>
        <button type="button" className="gacha-refill-button" onClick={() => onAddStones(STONE_REFILL_AMOUNT)}>
          + {STONE_REFILL_AMOUNT} 補充する
        </button>
      </div>

      <div className="gacha-mode-toggle">
        <button type="button" className={mode === 1 ? 'is-active' : ''} onClick={() => setMode(1)}>
          1回召喚
        </button>
        <button type="button" className={mode === 10 ? 'is-active' : ''} onClick={() => setMode(10)}>
          10連召喚（4★以上確定）
        </button>
      </div>

      <GachaLever disabled={stones < cost} label={leverLabel} onPull={runPull} />

      {error && <p className="error-text">{error}</p>}

      {reveal && <GachaRevealOverlay pulls={reveal} onClose={() => setReveal(null)} />}
    </div>
  )
}
