import type { Rarity } from './types'

let sharedContext: AudioContext | null = null

const getContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!sharedContext) sharedContext = new Ctor()
  if (sharedContext.state === 'suspended') void sharedContext.resume()
  return sharedContext
}

const playTone = (
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
) => {
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, startTime)
  gainNode.gain.setValueAtTime(0, startTime)
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.015)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.02)
}

/** ホワイトノイズのバースト（バンドパス通過）を鳴らす。卵が割れる「パキッ」という音や機械音に使う */
const playNoiseBurst = (ctx: AudioContext, startTime: number, duration: number, gain: number, filterHz: number) => {
  const bufferSize = Math.ceil(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(filterHz, startTime)
  filter.Q.value = 0.9

  const gainNode = ctx.createGain()
  gainNode.gain.setValueAtTime(gain, startTime)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  source.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(ctx.destination)
  source.start(startTime)
  source.stop(startTime + duration + 0.02)
}

/** レアリティが高いほど華やかな和音を鳴らす（卵が割れてモンスターが登場する瞬間の効果音） */
export const playGachaChime = (rarity: Rarity): void => {
  const ctx = getContext()
  if (!ctx) return

  const now = ctx.currentTime
  const base = 440 * Math.pow(2, (rarity - 3) / 12)

  playTone(ctx, base, now, 0.35, 0.12)

  if (rarity >= 4) {
    playTone(ctx, base * 1.5, now + 0.08, 0.35, 0.1)
  }
  if (rarity >= 5) {
    playTone(ctx, base * 2, now + 0.16, 0.45, 0.1)
  }
  if (rarity >= 6) {
    playTone(ctx, base * 2.5, now + 0.24, 0.55, 0.1)
  }
}

/** レバーを引いた瞬間の「ガコン」という機械音 */
export const playLeverClunk = (): void => {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 90, now, 0.18, 0.22, 'triangle')
  playTone(ctx, 55, now + 0.05, 0.22, 0.18, 'square')
}

/** 卵が落ちて着地する「ポトッ」という音 */
export const playEggDrop = (): void => {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 180, now, 0.12, 0.1, 'sine')
  playNoiseBurst(ctx, now, 0.06, 0.05, 800)
}

/** 卵が割れる瞬間の「パキッ」という音。レアリティが高いほど余韻が長い */
export const playEggCrack = (rarity: Rarity): void => {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  playNoiseBurst(ctx, now, 0.1, 0.35, 2400)
  playNoiseBurst(ctx, now + 0.03, 0.08 + rarity * 0.02, 0.2, 1400)
}
