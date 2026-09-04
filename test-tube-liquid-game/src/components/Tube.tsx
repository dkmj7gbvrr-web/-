import { isTubeSorted } from '../game/engine'
import { CAPACITY, COLOR_HEX, COLOR_NAMES } from '../game/types'
import type { Tube as TubeState } from '../game/types'

interface Props {
  tube: TubeState
  index: number
  selected: boolean
  onSelect: (index: number) => void
}

export function Tube({ tube, index, selected, onSelect }: Props) {
  const emptySlots = CAPACITY - tube.length
  const sorted = isTubeSorted(tube, CAPACITY) && tube.length === CAPACITY
  const label =
    tube.length === 0
      ? `試験管${index + 1}: 空`
      : `試験管${index + 1}: 下から ${tube.map((c) => COLOR_NAMES[c] ?? c).join(', ')}`

  return (
    <button
      type="button"
      className={`tube${selected ? ' tube--selected' : ''}${sorted ? ' tube--sorted' : ''}`}
      onClick={() => onSelect(index)}
      aria-label={label}
      aria-pressed={selected}
    >
      <span className="tube__glass">
        {tube.map((color, i) => (
          <span key={i} className="tube__segment" style={{ background: COLOR_HEX[color] }} />
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <span key={`empty-${i}`} className="tube__segment tube__segment--empty" />
        ))}
      </span>
    </button>
  )
}
