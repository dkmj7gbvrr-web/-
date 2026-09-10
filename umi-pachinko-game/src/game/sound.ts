/**
 * 効果音はすべて Web Audio API によるシンプルな合成音（オシレーター）で、
 * 実機の音源をサンプリングしたものではないオリジナル音。
 */
let ctx: AudioContext | null = null
let muted = false

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function setMuted(value: boolean): void {
  muted = value
}

export function isMuted(): boolean {
  return muted
}

function tone(freq: number, startOffset: number, duration: number, type: OscillatorType, gainPeak: number) {
  const audio = getContext()
  if (!audio || muted) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t0 = audio.currentTime + startOffset
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

export function playLaunch(): void {
  tone(280, 0, 0.08, 'triangle', 0.15)
}

export function playChucker(): void {
  tone(660, 0, 0.12, 'sine', 0.2)
  tone(880, 0.06, 0.14, 'sine', 0.18)
}

export function playPrize(): void {
  tone(520, 0, 0.08, 'square', 0.12)
}

export function playAttackerHit(): void {
  tone(740, 0, 0.07, 'sine', 0.2)
}

export function playFoul(): void {
  tone(160, 0, 0.15, 'sawtooth', 0.12)
}

export function playJackpotFanfare(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((freq, i) => tone(freq, i * 0.13, 0.28, 'triangle', 0.22))
}
