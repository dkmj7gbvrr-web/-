import { describe, expect, test } from 'vitest'
import { AD_REWARD, FALLBACK_REWARD, FALLBACK_WAIT, LOAD_TIMEOUT, RefillGate, type AdCallbacks, type AdProvider } from './refillGate'

class FakeProvider implements AdProvider {
  calls: AdCallbacks[] = []
  shown = 0
  request(cb: AdCallbacks) {
    this.calls.push(cb)
  }
  get last() {
    return this.calls[this.calls.length - 1]
  }
}

function setup(provider: AdProvider | null) {
  const granted: number[] = []
  const gate = new RefillGate(provider, (n) => granted.push(n))
  return { gate, granted }
}

describe('RefillGate', () => {
  test('広告なし（オーナー/未設定）ならボタンだけで補給できる', () => {
    const { gate, granted } = setup(null)
    gate.update(0.1, true)
    gate.press()
    expect(granted).toEqual([AD_REWARD])
  })

  test('玉が尽きるまで広告は要求しない', () => {
    const p = new FakeProvider()
    const { gate } = setup(p)
    gate.update(1, false)
    expect(p.calls.length).toBe(0)
    gate.update(0.1, true)
    expect(p.calls.length).toBe(1)
    expect(gate.state.kind).toBe('loading')
  })

  test('最後まで見たときだけ報酬が出る', () => {
    const p = new FakeProvider()
    const { gate, granted } = setup(p)
    gate.update(0.1, true)
    let shown = 0
    p.last.onReady(() => shown++)
    expect(gate.state.kind).toBe('ready')
    // 準備できただけでは報酬なし
    expect(granted).toEqual([])
    gate.press()
    expect(shown).toBe(1)
    p.last.onBeforeAd()
    expect(gate.paused).toBe(true)
    p.last.onViewed()
    p.last.onAfterAd()
    expect(gate.paused).toBe(false)
    expect(granted).toEqual([AD_REWARD])
  })

  test('途中で閉じたら報酬なしで、もう一度広告を用意する', () => {
    const p = new FakeProvider()
    const { gate, granted } = setup(p)
    gate.update(0.1, true)
    p.last.onReady(() => {})
    gate.press()
    p.last.onDismissed()
    expect(granted).toEqual([])
    gate.update(0.1, true)
    expect(p.calls.length).toBe(2)
  })

  test('広告が出せないときは待てば少しだけ補給できる（詰み防止）', () => {
    const p = new FakeProvider()
    const { gate, granted } = setup(p)
    gate.update(0.1, true)
    p.last.onUnavailable('noAdPreloaded')
    expect(gate.state.kind).toBe('wait')
    gate.press()
    expect(granted).toEqual([])
    gate.update(FALLBACK_WAIT + 0.1, true)
    expect(gate.state.kind).toBe('fallbackReady')
    gate.press()
    expect(granted).toEqual([FALLBACK_REWARD])
  })

  test('SDK が応答しなければタイムアウトして救済に回る。遅れて届いた応答は無視', () => {
    const p = new FakeProvider()
    const { gate, granted } = setup(p)
    gate.update(0.1, true)
    const stale = p.last
    gate.update(LOAD_TIMEOUT + 1, true)
    expect(gate.state.kind).toBe('wait')
    stale.onReady(() => {})
    stale.onViewed()
    expect(gate.state.kind).toBe('wait')
    expect(granted).toEqual([])
  })
})
