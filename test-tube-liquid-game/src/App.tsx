import './App.css'
import { DifficultySelector } from './components/DifficultySelector'
import { Tube } from './components/Tube'
import { DIFFICULTIES } from './game/types'
import { useLiquidSortGame } from './hooks/useLiquidSortGame'

const formatTime = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function App() {
  const game = useLiquidSortGame()
  const {
    level,
    tubes,
    selected,
    moves,
    isGenerating,
    elapsedSeconds,
    won,
    canUndo,
    startNewGame,
    backToMenu,
    selectTube,
    undo,
    resetPuzzle,
  } = game

  if (level === null) {
    return (
      <div className="app">
        <DifficultySelector onSelect={startNewGame} />
      </div>
    )
  }

  if (isGenerating || !tubes) {
    return (
      <div className="app">
        <div className="generating">
          <div className="generating__spinner" aria-hidden="true" />
          <p>問題を作成しています…</p>
        </div>
      </div>
    )
  }

  const difficultyInfo = DIFFICULTIES.find((d) => d.level === level)!

  return (
    <div className="app">
      <header className="game-header">
        <button type="button" className="game-header__back" onClick={backToMenu}>
          ← 難易度選択
        </button>
        <div className="game-header__info">
          <span className="game-header__difficulty">{difficultyInfo.label}</span>
          <span className="game-header__stat">手数: {moves}</span>
          <span className="game-header__stat">{formatTime(elapsedSeconds)}</span>
        </div>
        <button type="button" className="game-header__new" onClick={() => startNewGame(level)}>
          新しい問題
        </button>
      </header>

      <main className="game-main">
        <div className="tube-area">
          {tubes.map((tube, i) => (
            <Tube key={i} tube={tube} index={i} selected={selected === i} onSelect={selectTube} />
          ))}
        </div>

        <div className="toolbar">
          <button type="button" onClick={undo} disabled={!canUndo || won}>
            ↩ もどす
          </button>
          <button type="button" onClick={resetPuzzle} disabled={won}>
            ⟳ はじめから
          </button>
        </div>

        {won && (
          <div className="solved-overlay">
            <p className="solved-overlay__title">クリア！</p>
            <p className="solved-overlay__time">
              手数: {moves} / タイム: {formatTime(elapsedSeconds)}
            </p>
            <div className="solved-overlay__actions">
              <button type="button" onClick={() => startNewGame(level)}>
                次の問題
              </button>
              <button type="button" onClick={backToMenu}>
                難易度を変える
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
