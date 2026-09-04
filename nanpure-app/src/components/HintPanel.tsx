import type { HintDisplay } from '../hooks/useSudokuGame'

interface Props {
  hint: HintDisplay | null
  onRequestHint: () => void
  onApplyFill: () => void
  onApplyElimination: () => void
  onClose: () => void
  disabled: boolean
}

export const HintPanel = ({
  hint,
  onRequestHint,
  onApplyFill,
  onApplyElimination,
  onClose,
  disabled,
}: Props) => {
  if (!hint) {
    return (
      <div className="hint-panel hint-panel--idle">
        <button type="button" className="hint-panel__request" onClick={onRequestHint} disabled={disabled}>
          ヒントを見る
        </button>
      </div>
    )
  }

  if (hint.kind === 'none-left') {
    return (
      <div className="hint-panel">
        <p className="hint-panel__text">盤面はすべて埋まっています。</p>
        <button type="button" className="hint-panel__close" onClick={onClose}>
          閉じる
        </button>
      </div>
    )
  }

  if (hint.kind === 'fallback') {
    return (
      <div className="hint-panel">
        <p className="hint-panel__technique">高度な推理が必要なマス</p>
        <p className="hint-panel__text">
          このマスは、現在実装されている解法テクニックでは論理的な説明ができない、非常に高度な推理（複数の仮定を積み重ねる読み筋）が必要な状態です。参考として、正解の数字「{hint.digit}」をハイライトしています。
        </p>
        <div className="hint-panel__actions">
          <button type="button" className="hint-panel__apply" onClick={onApplyFill}>
            この数字を入力する
          </button>
          <button type="button" className="hint-panel__close" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    )
  }

  const { step } = hint
  return (
    <div className="hint-panel">
      <p className="hint-panel__technique">{step.techniqueName}</p>
      <p className="hint-panel__text">{step.explanation}</p>
      <div className="hint-panel__actions">
        {step.fill ? (
          <button type="button" className="hint-panel__apply" onClick={onApplyFill}>
            {step.fill.digit}を入力する
          </button>
        ) : (
          <button type="button" className="hint-panel__apply" onClick={onApplyElimination}>
            メモから候補を消す
          </button>
        )}
        <button type="button" className="hint-panel__close" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  )
}
