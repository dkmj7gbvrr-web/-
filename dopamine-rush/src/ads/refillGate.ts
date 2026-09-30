/**
 * 玉の補給を「リワード広告を最後まで見たら」に限定する状態機械。
 * 広告 SDK には依存せず、AdProvider を差し替えてテストできるようにしている。
 */

export interface AdCallbacks {
  /** 広告が用意できた。show() はプレイヤーの操作（タップ）の中で呼ぶ */
  onReady(show: () => void): void
  /** 最後まで視聴した → 報酬を渡す */
  onViewed(): void
  /** 途中で閉じた → 報酬なし */
  onDismissed(): void
  /** 広告を出せなかった（未準備・頻度制限・広告ブロック・タイムアウトなど） */
  onUnavailable(reason: string): void
  /** 広告の表示直前（ゲームを止めて消音する）/ 表示後 */
  onBeforeAd(): void
  onAfterAd(): void
}

export interface AdProvider {
  request(cb: AdCallbacks): void
}

export type GateState =
  | { kind: 'free' }
  | { kind: 'idle' }
  | { kind: 'loading'; elapsed: number }
  | { kind: 'ready' }
  | { kind: 'showing' }
  | { kind: 'wait'; left: number; reason: string }
  | { kind: 'fallbackReady' }

export const AD_REWARD = 300
/** 広告が出せないときの救済：待てば少しだけ無料で補給できる（詰み防止） */
export const FALLBACK_WAIT = 60
export const FALLBACK_REWARD = 100
/** SDK から何も返ってこないときに諦めるまでの秒数 */
export const LOAD_TIMEOUT = 10

export class RefillGate {
  state: GateState
  /** 広告表示中はゲームを止める */
  paused = false
  private show: (() => void) | null = null
  /** 古いリクエストのコールバックを無視するための番号 */
  private requestId = 0
  private readonly provider: AdProvider | null
  private readonly grant: (amount: number) => void

  /**
   * @param provider null のとき（オーナー、または広告未設定）は常に無料で補給できる
   * @param grant 玉を渡す処理
   */
  constructor(provider: AdProvider | null, grant: (amount: number) => void) {
    this.provider = provider
    this.grant = grant
    this.state = provider ? { kind: 'idle' } : { kind: 'free' }
  }

  /** 毎フレーム呼ぶ。needsRefill は「玉が尽きて補給が必要な状態か」 */
  update(dt: number, needsRefill: boolean) {
    const s = this.state
    if (s.kind === 'idle' && needsRefill) this.request()
    else if (s.kind === 'loading') {
      s.elapsed += dt
      if (s.elapsed > LOAD_TIMEOUT) this.unavailable('timeout')
    } else if (s.kind === 'wait') {
      s.left -= dt
      if (s.left <= 0) this.state = { kind: 'fallbackReady' }
    }
  }

  /** 補給ボタンが押された（プレイヤー操作の中で呼ぶ） */
  press() {
    const s = this.state
    if (s.kind === 'free') {
      this.grant(AD_REWARD)
    } else if (s.kind === 'ready' && this.show) {
      const show = this.show
      this.show = null
      this.state = { kind: 'showing' }
      show()
    } else if (s.kind === 'fallbackReady') {
      this.state = { kind: 'idle' }
      this.grant(FALLBACK_REWARD)
    }
  }

  private request() {
    const id = ++this.requestId
    this.state = { kind: 'loading', elapsed: 0 }
    const live = () => id === this.requestId
    this.provider!.request({
      onReady: (show) => {
        if (!live() || this.state.kind !== 'loading') return
        this.show = show
        this.state = { kind: 'ready' }
      },
      onViewed: () => {
        if (!live()) return
        this.paused = false
        this.state = { kind: 'idle' }
        this.grant(AD_REWARD)
      },
      onDismissed: () => {
        if (!live()) return
        this.paused = false
        // 報酬なし。次のフレームでまた広告を用意する
        this.state = { kind: 'idle' }
      },
      onUnavailable: (reason) => {
        if (!live()) return
        // 表示後の adBreakDone（viewed / dismissed）はここに来ない想定だが、念のため状態で判定
        if (this.state.kind === 'loading' || this.state.kind === 'ready') this.unavailable(reason)
      },
      onBeforeAd: () => {
        if (live()) this.paused = true
      },
      onAfterAd: () => {
        if (live()) this.paused = false
      },
    })
  }

  private unavailable(reason: string) {
    this.requestId++
    this.show = null
    this.paused = false
    this.state = { kind: 'wait', left: FALLBACK_WAIT, reason }
  }
}
