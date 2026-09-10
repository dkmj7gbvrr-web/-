import { useEffect, useState } from 'react'
import type { ReelState } from '../game/types'

interface ReelDisplayProps {
  reel: ReelState
}

const REACH_LABEL: Record<string, string> = {
  normal: 'リーチ！',
  super: 'スーパーリーチ！！',
  premium: 'プレミアリーチ！？',
}

export function ReelDisplay({ reel }: ReelDisplayProps) {
  const [spinDigits, setSpinDigits] = useState<[number, number, number]>([0, 0, 0])

  useEffect(() => {
    if (!reel.spinning) return
    const id = setInterval(() => {
      setSpinDigits([
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10),
      ])
    }, 70)
    return () => clearInterval(id)
  }, [reel.spinning])

  const outcome = reel.outcome
  const slots = [0, 1, 2].map((i) => {
    const stopped = i < reel.stoppedCount || !reel.spinning
    const value = stopped ? (outcome ? outcome.result[i] : '-') : spinDigits[i]
    return { stopped, value }
  })

  const isReach = reel.spinning && reel.stoppedCount >= 2 && !!outcome && outcome.reachTier !== 'none'
  const reachTier = outcome?.reachTier ?? 'none'

  return (
    <div className="reel-display-wrap">
      {isReach && (
        <div className={`reach-banner reach-banner--${reachTier}`}>{REACH_LABEL[reachTier]}</div>
      )}
      <div
        className={`reel-display${outcome?.isJackpot && !reel.spinning ? ' reel-display--win' : ''}${
          isReach ? ` reel-display--reach-${reachTier}` : ''
        }`}
      >
        {slots.map((slot, i) => (
          <div key={i} className={`reel-slot${slot.stopped ? ' reel-slot--stopped' : ' reel-slot--spinning'}`}>
            {slot.value}
          </div>
        ))}
      </div>
    </div>
  )
}
