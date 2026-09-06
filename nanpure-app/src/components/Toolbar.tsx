interface IconProps {
  className?: string
}

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const UndoIcon = ({ className }: IconProps) => (
  <svg className={className} {...iconProps}>
    <path d="M3 11h10a5 5 0 0 1 0 10h-2" />
    <polyline points="7 7 3 11 7 15" />
  </svg>
)

const EraseIcon = ({ className }: IconProps) => (
  <svg className={className} {...iconProps}>
    <path d="m7 20-3.5-3.5a1.6 1.6 0 0 1 0-2.3l8.4-8.4a1.6 1.6 0 0 1 2.3 0l4.6 4.6a1.6 1.6 0 0 1 0 2.3L13.5 18" />
    <path d="M6 20h13" />
  </svg>
)

const PencilIcon = ({ className }: IconProps) => (
  <svg className={className} {...iconProps}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
)

const BulbIcon = ({ className }: IconProps) => (
  <svg className={className} {...iconProps}>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" />
  </svg>
)

interface Props {
  memoMode: boolean
  hintActive: boolean
  onUndo: () => void
  canUndo: boolean
  onErase: () => void
  onToggleMemo: () => void
  onHint: () => void
  disabled: boolean
}

export const Toolbar = ({
  memoMode,
  hintActive,
  onUndo,
  canUndo,
  onErase,
  onToggleMemo,
  onHint,
  disabled,
}: Props) => {
  return (
    <div className="toolbar">
      <button type="button" className="toolbar__item" onClick={onUndo} disabled={disabled || !canUndo}>
        <UndoIcon className="toolbar__icon" />
        <span className="toolbar__label">元に戻す</span>
      </button>
      <button type="button" className="toolbar__item" onClick={onErase} disabled={disabled}>
        <EraseIcon className="toolbar__icon" />
        <span className="toolbar__label">消す</span>
      </button>
      <button
        type="button"
        className={'toolbar__item' + (memoMode ? ' toolbar__item--active' : '')}
        onClick={onToggleMemo}
        disabled={disabled}
      >
        <PencilIcon className="toolbar__icon" />
        <span className="toolbar__label">メモ{memoMode ? ' ON' : ''}</span>
      </button>
      <button
        type="button"
        className={'toolbar__item' + (hintActive ? ' toolbar__item--active' : '')}
        onClick={onHint}
        disabled={disabled}
      >
        <BulbIcon className="toolbar__icon" />
        <span className="toolbar__label">ヒント</span>
      </button>
    </div>
  )
}
