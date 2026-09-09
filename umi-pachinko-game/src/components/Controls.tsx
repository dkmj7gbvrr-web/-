interface ControlsProps {
  power: number
  onPowerChange: (value: number) => void
  autoFire: boolean
  onAutoFireChange: (value: boolean) => void
  muted: boolean
  onToggleMuted: () => void
  onLaunch: () => void
  onRefill: () => void
  ballCount: number
}

export function Controls({
  power,
  onPowerChange,
  autoFire,
  onAutoFireChange,
  muted,
  onToggleMuted,
  onLaunch,
  onRefill,
  ballCount,
}: ControlsProps) {
  return (
    <div className="controls">
      <label className="controls-power">
        <span>発射強さ ({power})</span>
        <input
          type="range"
          min={0}
          max={100}
          value={power}
          onChange={(e) => onPowerChange(Number(e.target.value))}
        />
      </label>

      <div className="controls-buttons">
        <button type="button" className="btn btn--launch" onClick={onLaunch} disabled={ballCount <= 0}>
          発射
        </button>
        <label className="btn-toggle">
          <input
            type="checkbox"
            checked={autoFire}
            onChange={(e) => onAutoFireChange(e.target.checked)}
          />
          連続発射
        </label>
        <button type="button" className="btn btn--ghost" onClick={onToggleMuted}>
          {muted ? '🔇 音を出す' : '🔊 音を消す'}
        </button>
      </div>

      {ballCount <= 0 && (
        <button type="button" className="btn btn--refill" onClick={onRefill}>
          持ち球を補充する (+500)
        </button>
      )}
    </div>
  )
}
