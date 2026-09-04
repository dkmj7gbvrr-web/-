interface HpBarProps {
  readonly current: number
  readonly max: number
  readonly color: string
}

export const HpBar = ({ current, max, color }: HpBarProps) => {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0
  return (
    <div className="hp-bar-track">
      <div className="hp-bar-fill" style={{ width: `${ratio * 100}%`, background: color }} />
      <span className="hp-bar-label">
        {Math.max(0, Math.round(current))} / {max}
      </span>
    </div>
  )
}
