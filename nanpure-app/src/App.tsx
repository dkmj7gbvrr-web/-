import { useEffect } from 'react'
import './App.css'
import { Board } from './components/Board'
import { DifficultySelector } from './components/DifficultySelector'
import { HintPanel } from './components/HintPanel'
import { NumberPad } from './components/NumberPad'
import { useSudokuGame } from './hooks/useSudokuGame'
import { DIFFICULTIES } from './sudoku/types'
import type { Digit } from './sudoku/types'

const formatTime = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function App() {
  const game = useSudokuGame()
  const {
    difficulty,
    puzzle,
    board,
    selected,
    memoMode,
    isGenerating,
    elapsedSeconds,
    hint,
    isSolved,
    conflicts,
    remainingCounts,
    setSelected,
    setMemoMode,
    startNewGame,
    backToMenu,
    inputDigit,
    eraseSelected,
    requestHint,
    applyHintFill,
    applyHintElimination,
    clearHint,
  } = game

  useEffect(() => {
    if (!puzzle || isSolved) return
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') {
        inputDigit(Number(e.key) as Digit)
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        eraseSelected()
        return
      }
      if (selected === null) return
      const row = Math.floor(selected / 9)
      const col = selected % 9
      if (e.key === 'ArrowUp') setSelected(((row + 8) % 9) * 9 + col)
      else if (e.key === 'ArrowDown') setSelected(((row + 1) % 9) * 9 + col)
      else if (e.key === 'ArrowLeft') setSelected(row * 9 + ((col + 8) % 9))
      else if (e.key === 'ArrowRight') setSelected(row * 9 + ((col + 1) % 9))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [puzzle, isSolved, selected, inputDigit, eraseSelected, setSelected])

  if (difficulty === null) {
    return (
      <div className="app">
        <DifficultySelector onSelect={startNewGame} />
      </div>
    )
  }

  if (isGenerating || !puzzle) {
    return (
      <div className="app">
        <div className="generating">
          <div className="generating__spinner" aria-hidden="true" />
          <p>問題を作成しています…</p>
        </div>
      </div>
    )
  }

  const difficultyInfo = DIFFICULTIES.find((d) => d.level === difficulty)!

  return (
    <div className="app">
      <header className="game-header">
        <button type="button" className="game-header__back" onClick={backToMenu}>
          ← 難易度選択
        </button>
        <div className="game-header__info">
          <span className="game-header__difficulty">{difficultyInfo.label}</span>
          <span className="game-header__timer">{formatTime(elapsedSeconds)}</span>
        </div>
        <button type="button" className="game-header__new" onClick={() => startNewGame(difficulty)}>
          新しい問題
        </button>
      </header>

      <main className="game-main">
        <div className="board-area">
          <Board board={board} selected={selected} conflicts={conflicts} hint={hint} onSelect={setSelected} />
          {isSolved && (
            <div className="solved-overlay">
              <p className="solved-overlay__title">クリア！</p>
              <p className="solved-overlay__time">タイム: {formatTime(elapsedSeconds)}</p>
              <div className="solved-overlay__actions">
                <button type="button" onClick={() => startNewGame(difficulty)}>
                  もう一度
                </button>
                <button type="button" onClick={backToMenu}>
                  難易度を変える
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="side-area">
          <NumberPad
            remainingCounts={remainingCounts}
            memoMode={memoMode}
            onDigit={inputDigit}
            onErase={eraseSelected}
            onToggleMemo={() => setMemoMode((m) => !m)}
            disabled={isSolved}
          />
          <HintPanel
            hint={hint}
            onRequestHint={requestHint}
            onApplyFill={applyHintFill}
            onApplyElimination={applyHintElimination}
            onClose={clearHint}
            disabled={isSolved}
          />
        </div>
      </main>
    </div>
  )
}

export default App
