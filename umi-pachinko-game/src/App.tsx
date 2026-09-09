import './App.css'
import { Board } from './components/Board'
import { Controls } from './components/Controls'
import { ReelDisplay } from './components/ReelDisplay'
import { StatusPanel } from './components/StatusPanel'
import { usePachinkoGame } from './hooks/usePachinkoGame'

function App() {
  const {
    state,
    stateRef,
    ballsRef,
    pinsRef,
    pocketsRef,
    power,
    setPower,
    autoFire,
    setAutoFire,
    muted,
    toggleMuted,
    launch,
    refill,
  } = usePachinkoGame()

  return (
    <div className="app">
      <header className="app-header">
        <h1>海の宝探し物語</h1>
        <p className="app-subtitle">海テーマのオリジナル・パチンコシミュレーター</p>
      </header>

      <main className="app-main">
        <div className="board-column">
          <ReelDisplay reel={state.reel} />
          <div className="board-frame">
            <Board ballsRef={ballsRef} pinsRef={pinsRef} pocketsRef={pocketsRef} stateRef={stateRef} />
          </div>
          <Controls
            power={power}
            onPowerChange={setPower}
            autoFire={autoFire}
            onAutoFireChange={setAutoFire}
            muted={muted}
            onToggleMuted={toggleMuted}
            onLaunch={launch}
            onRefill={refill}
            ballCount={state.stats.ballCount}
          />
        </div>

        <aside className="side-column">
          <StatusPanel state={state} />
          <div className="log-panel">
            <h2>ゲームログ</h2>
            <ul>
              {[...state.log]
                .reverse()
                .slice(0, 12)
                .map((entry, i) => (
                  <li key={state.log.length - i}>{entry}</li>
                ))}
            </ul>
          </div>
        </aside>
      </main>

      <footer className="app-footer">
        <p>
          実在のパチンコ機種の名称・キャラクター・音源を再現したものではなく、オリジナルデザインの海テーマ作品です。
          持ち球は本アプリ内だけの仮想の数値で、現金への交換価値はありません。
        </p>
      </footer>
    </div>
  )
}

export default App
