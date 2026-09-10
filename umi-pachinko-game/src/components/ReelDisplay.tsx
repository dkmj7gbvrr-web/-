import { useEffect, useState } from 'react'
import type { ReelState } from '../game/types'

interface ReelDisplayProps {
  reel: ReelState
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

  const slots = [0, 1, 2].map((i) => {
    const stopped = i < reel.stoppedCount || !reel.spinning
    const value = stopped ? (reel.result ? reel.result[i] : '-') : spinDigits[i]
    return { stopped, value }
  })

  return (
    <div className={`reel-display${reel.isJackpot && !reel.spinning ? ' reel-display--win' : ''}`}>
      {slots.map((slot, i) => (
        <div key={i} className={`reel-slot${slot.stopped ? ' reel-slot--stopped' : ' reel-slot--spinning'}`}>
          {slot.value}
        </div>
      ))}
    </div>
  )
}
