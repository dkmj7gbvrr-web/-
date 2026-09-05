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
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.012)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.02)
}

/** ホワイトノイズのバースト（バンドパス通過）を鳴らす。卵が割れる音や機械音に使う */
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

const COMBO_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 987.77]

/**
 * オーブが1グループ消える瞬間の「ポン」という音。comboIndex（そのターンの通算コンボ数）が
 * 増えるほど音階が上がっていき、連鎖が重なるほど気持ちよく聞こえるようにしている。
 * groupSizeが大きい（多消し）ほど音に厚みが増す。
 */
export const playOrbClear = (comboIndex: number, groupSize: number): void => {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  const octave = Math.min(2, Math.floor((comboIndex - 1) / COMBO_SCALE.length))
  const note = COMBO_SCALE[(comboIndex - 1) % COMBO_SCALE.length] * Math.pow(2, octave)

  playTone(ctx, note, now, 0.22, 0.12, 'sine')
  if (groupSize >= 4) playTone(ctx, note * 1.5, now + 0.02, 0.22, 0.08, 'sine')
  if (groupSize >= 5) playTone(ctx, note * 2, now + 0.04, 0.24, 0.07, 'sine')
}

/** レバーを引いた瞬間の「ガコン」という機械音 */
export const playLeverClunk = (): void => {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 90, now, 0.18, 0.22, 'triangle')
  playTone(ctx, 55, now + 0.05, 0.22, 0.18, 'square')
}

/**
 * 卵が割れる瞬間の音。衝撃音→複数の破片が弾ける音→（レア度が高い場合）余韻のきらめき、
 * という3段構えにして単調にならないようにしている
 */
export const playEggCrack = (rarity: Rarity): void => {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime

  // 衝撃（低音のドスッ）
  playTone(ctx, 70, now, 0.12, 0.22, 'triangle')
  // 殻が弾け飛ぶ破片音を数回ずらして重ねる
  playNoiseBurst(ctx, now + 0.01, 0.09, 0.4, 2600)
  playNoiseBurst(ctx, now + 0.05, 0.07, 0.28, 1800)
  playNoiseBurst(ctx, now + 0.09, 0.1, 0.2, 3400)
  if (rarity >= 3) {
    playNoiseBurst(ctx, now + 0.14, 0.09, 0.16, 2200)
  }

  // レア度が高いほど、割れた後にきらめくような余韻を足す
  if (rarity >= 4) {
    const shimmerNotes = [1046.5, 1318.5, 1568]
    const count = rarity >= 6 ? 3 : rarity >= 5 ? 2 : 1
    for (let i = 0; i < count; i++) {
      playTone(ctx, shimmerNotes[i], now + 0.22 + i * 0.09, 0.5, 0.08, 'sine')
    }
  }
}

/** 音程が駆け上がる緊張感の音。卵の格上げ演出などの「溜め」に使う */
export const playTensionRise = (durationSec: number): void => {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(160, now)
  osc.frequency.exponentialRampToValueAtTime(560, now + durationSec)
  gainNode.gain.setValueAtTime(0, now)
  gainNode.gain.linearRampToValueAtTime(0.05, now + 0.1)
  gainNode.gain.linearRampToValueAtTime(0.08, now + durationSec * 0.8)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.1)
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + durationSec + 0.15)
}

/**
 * ダイヤの卵が虹卵へと格上げされる瞬間の音。駆け上がる音のあとにきらめく高音を重ねる
 * （本家パズドラで卵の格が土壇場で上がる演出のイメージ）
 */
export const playEggUpgrade = (): void => {
  const ctx = getContext()
  if (!ctx) return
  playTensionRise(0.5)
  const now = ctx.currentTime
  playTone(ctx, 1568, now + 0.42, 0.4, 0.13, 'sine')
  playTone(ctx, 2093, now + 0.5, 0.45, 0.11, 'sine')
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
