import { MAX_HOLDS } from '../game/odds'
import type { HoldEntry } from '../game/types'

interface HoldQueueProps {
  holds: HoldEntry[]
}

const TELL_LABEL: Record<HoldEntry['tell'], string> = {
  white: '白',
  blue: '青',
  green: '緑',
  red: '赤',
  rainbow: '虹',
}

export function HoldQueue({ holds }: HoldQueueProps) {
  const slots = Array.from({ length: MAX_HOLDS }, (_, i) => holds[i] ?? null)

  return (
    <div className="hold-queue">
      <span className="hold-queue__label">保留 (先読み)</span>
      <div className="hold-queue__slots">
        {slots.map((hold, i) => (
          <div
            key={hold?.id ?? `empty-${i}`}
            className={`hold-ball${hold ? ` hold-ball--${hold.tell}` : ' hold-ball--empty'}`}
            title={hold ? `${TELL_LABEL[hold.tell]}保留` : '保留なし'}
          />
        ))}
      </div>
    </div>
  )
}
