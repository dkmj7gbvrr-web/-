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

/** スロットリールが1つ止まる「カチッ」という音。reelIndexが大きいほど高い音にして緊張感を積み上げる */
export const playReelStop = (reelIndex: number): void => {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 260 + reelIndex * 90, now, 0.09, 0.18, 'square')
  playNoiseBurst(ctx, now, 0.03, 0.12, 3200)
}

/** リーチ中に鳴らす、音程が徐々に駆け上がる緊張感の音（パチンコのリーチ演出のイメージ） */
export const playTensionRise = (durationSec: number): void => {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(140, now)
  osc.frequency.exponentialRampToValueAtTime(520, now + durationSec)
  gainNode.gain.setValueAtTime(0, now)
  gainNode.gain.linearRampToValueAtTime(0.07, now + 0.1)
  gainNode.gain.linearRampToValueAtTime(0.1, now + durationSec * 0.8)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.1)
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + durationSec + 0.15)
}

/** 大当たり演出（レア確定バナー表示時）のファンファーレ。レアリティが高いほど音数が増える */
export const playBigWinFanfare = (rarity: Rarity): void => {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  const notes = [523.25, 659.25, 783.99, 987.77, 1174.66]
  const noteCount = rarity >= 6 ? 5 : rarity >= 5 ? 4 : 3
  for (let i = 0; i < noteCount; i++) {
    playTone(ctx, notes[i], now + i * 0.09, 0.4, 0.14, 'triangle')
  }
  playTone(ctx, notes[noteCount - 1] * 2, now + noteCount * 0.09, 0.6, 0.1, 'sine')
}
