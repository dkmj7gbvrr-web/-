import { useState } from 'react'
import type { PullRecord } from '../game/gacha'
import { PITY_THRESHOLD } from '../game/gacha'
import { MonsterCard } from './MonsterCard'

interface GachaScreenProps {
  readonly stones: number
  readonly singleCost: number
  readonly multiCost: number
  readonly pullsSincePity: number
  readonly onPullSingle: () => readonly PullRecord[] | null
  readonly onPullMulti: () => readonly PullRecord[] | null
}

export const GachaScreen = ({
  stones,
  singleCost,
  multiCost,
  pullsSincePity,
  onPullSingle,
  onPullMulti,
}: GachaScreenProps) => {
  const [results, setResults] = useState<readonly PullRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runPull = (fn: () => readonly PullRecord[] | null) => {
    setError(null)
    const pulls = fn()
    if (!pulls) {
      setError('魔法石が足りません！')
      return
    }
    setResults(pulls)
  }

  return (
    <div className="screen gacha-screen">
      <h2>ガチャ召喚の間</h2>
      <p className="gacha-lead">魔法石を捧げて、新たな仲間モンスターを召喚しよう。</p>
      <p className="gacha-pity">次の天井まであと{Math.max(0, PITY_THRESHOLD - pullsSincePity)}回（天井到達で5★以上確定）</p>

      <div className="gacha-buttons">
        <button className="primary-button" onClick={() => runPull(onPullSingle)} disabled={stones < singleCost}>
          1回召喚（魔法石 {singleCost}）
        </button>
        <button className="primary-button primary-button--gold" onClick={() => runPull(onPullMulti)} disabled={stones < multiCost}>
          10連召喚（魔法石 {multiCost}・4★以上確定）
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {results && (
        <div className="gacha-results">
          <h3>召喚結果</h3>
          <div className="gacha-results-grid">
            {results.map((pull, index) => (
              <MonsterCard
                key={`${pull.monster.id}-${index}`}
                def={pull.monster}
                badge={pull.pityTriggered ? '天井' : pull.monster.rarity >= 5 ? 'PICKUP' : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
