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

const playTone = (ctx: AudioContext, frequency: number, startTime: number, duration: number, gain: number) => {
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency, startTime)
  gainNode.gain.setValueAtTime(0, startTime)
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.02)
}

/** レアリティが高いほど華やかな和音を鳴らす（ガチャ演出の効果音）。オーディオが使えない環境では何もしない */
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
