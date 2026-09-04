interface HomeScreenProps {
  readonly stones: number
  readonly coins: number
  readonly ownedCount: number
  readonly clearedCount: number
  readonly onNavigate: (tab: 'gacha' | 'stage') => void
}

export const HomeScreen = ({ stones, coins, ownedCount, clearedCount, onNavigate }: HomeScreenProps) => {
  return (
    <div className="screen home-screen">
      <h1>パズル召喚士</h1>
      <p className="screen-lead">
        オーブを繋いでモンスターと共に戦う、パズル×収集RPG。ガチャで仲間を集めて、最強のパーティを組もう！
      </p>

      <div className="home-stats">
        <div className="home-stat-card">
          <span className="home-stat-label">魔法石</span>
          <span className="home-stat-value">💎 {stones}</span>
        </div>
        <div className="home-stat-card">
          <span className="home-stat-label">コイン</span>
          <span className="home-stat-value">🪙 {coins}</span>
        </div>
        <div className="home-stat-card">
          <span className="home-stat-label">所持モンスター</span>
          <span className="home-stat-value">{ownedCount}体</span>
        </div>
        <div className="home-stat-card">
          <span className="home-stat-label">クリア済ステージ</span>
          <span className="home-stat-value">{clearedCount}</span>
        </div>
      </div>

      <div className="home-actions">
        <button className="primary-button primary-button--gold" onClick={() => onNavigate('gacha')}>
          ガチャを引く
        </button>
        <button className="primary-button" onClick={() => onNavigate('stage')}>
          ダンジョンに挑む
        </button>
      </div>

      <div className="home-howto">
        <h3>遊び方</h3>
        <ol>
          <li>オーブを1つ押さえて、隣のマスへドラッグして動かそう。</li>
          <li>同じ属性のオーブを3つ以上つなげると消えて攻撃になる。</li>
          <li>ハートのオーブを揃えるとHPが回復する。</li>
          <li>敵のHPを0にすればステージクリア！</li>
        </ol>
      </div>
    </div>
  )
}
