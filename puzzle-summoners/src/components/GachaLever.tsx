import { useRef, useState } from 'react'
import { playLeverClunk } from '../game/sound'

interface GachaLeverProps {
  readonly disabled: boolean
  readonly label: string
  readonly onPull: () => void
}

const PULL_DOWN_MS = 260
const SPRING_BACK_MS = 420

/** スロットマシンのレバーのように「下ろす→跳ね返る」動きでガチャを引く体験を演出するボタン */
export const GachaLever = ({ disabled, label, onPull }: GachaLeverProps) => {
  const [pulling, setPulling] = useState(false)
  const timeoutsRef = useRef<number[]>([])

  const handleClick = () => {
    if (disabled || pulling) return
    playLeverClunk()
    setPulling(true)

    const commitTimeout = window.setTimeout(() => {
      onPull()
    }, PULL_DOWN_MS)
    const resetTimeout = window.setTimeout(() => {
      setPulling(false)
    }, PULL_DOWN_MS + SPRING_BACK_MS)

    timeoutsRef.current.forEach((id) => window.clearTimeout(id))
    timeoutsRef.current = [commitTimeout, resetTimeout]
  }

  return (
    <button
      type="button"
      className={`gacha-lever${pulling ? ' gacha-lever--pulling' : ''}`}
      onClick={handleClick}
      disabled={disabled || pulling}
    >
      <span className="gacha-lever-track">
        <span className="gacha-lever-handle" />
      </span>
      <span className="gacha-lever-label">{label}</span>
    </button>
  )
}
