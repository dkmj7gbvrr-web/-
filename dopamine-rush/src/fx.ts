/**
 * 画面効果（ジュース）：パーティクル・画面揺れ・フラッシュ・ヒットストップ・スロー・大文字テロップ。
 * 「少ない入力に対して、何倍もの反応を返す」ことを担当する層。
 */

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  kind: 'spark' | 'confetti' | 'coin' | 'ring' | 'star'
  rot: number
  vr: number
}

export interface Popup {
  x: number
  y: number
  text: string
  color: string
  life: number
  size: number
}

export interface Banner {
  text: string
  sub?: string
  color: string
  life: number
  max: number
  size: number
  rainbow: boolean
  priority: number
}

export class Fx {
  particles: Particle[] = []
  popups: Popup[] = []
  banner: Banner | null = null
  /** 0〜1。揺れ幅は trauma² に比例させる（小さい揺れは控えめ、大きい揺れは一気に大きく） */
  trauma = 0
  flash = 0
  flashColor = '#fff'
  hitstop = 0
  slowmo = 0
  /** 画面全体を虹色にする強さ（大当たり・RUSH） */
  rainbow = 0
  reducedMotion = false

  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount * (this.reducedMotion ? 0.3 : 1))
  }

  doFlash(strength: number, color = '#fff') {
    this.flash = Math.max(this.flash, strength * (this.reducedMotion ? 0.25 : 1))
    this.flashColor = color
  }

  stop(seconds: number) {
    this.hitstop = Math.max(this.hitstop, seconds)
  }

  slow(seconds: number) {
    this.slowmo = Math.max(this.slowmo, seconds)
  }

  burst(x: number, y: number, n: number, colors: string[], speed = 220, kind: Particle['kind'] = 'spark') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.3 + Math.random() * 0.7)
      const max = 0.4 + Math.random() * 0.6
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (kind === 'coin' ? 200 : 0),
        life: max,
        max,
        size: kind === 'confetti' ? 5 + Math.random() * 5 : kind === 'coin' ? 5 : 1.5 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        kind,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
      })
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900)
  }

  ring(x: number, y: number, color: string, size = 60) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, size, color, kind: 'ring', rot: 0, vr: 0 })
  }

  confettiRain(n: number, w: number) {
    for (let i = 0; i < n; i++) {
      const max = 2 + Math.random() * 1.5
      this.particles.push({
        x: Math.random() * w,
        y: -10 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 80,
        vy: 80 + Math.random() * 120,
        life: max,
        max,
        size: 5 + Math.random() * 6,
        color: `hsl(${Math.floor(Math.random() * 360)},95%,60%)`,
        kind: 'confetti',
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 14,
      })
    }
  }

  popup(x: number, y: number, text: string, color = '#fff', size = 16) {
    this.popups.push({ x, y, text, color, life: 0.9, size })
  }

  /**
   * 中央の大文字テロップ。priority が低いテロップは、表示中の高いテロップを
   * （寿命の半分を過ぎるまで）上書きしない。大当たりの瞬間を小さな演出で潰さないため。
   */
  show(
    text: string,
    opts: { sub?: string; color?: string; dur?: number; size?: number; rainbow?: boolean; priority?: number } = {},
  ) {
    const priority = opts.priority ?? 1
    const cur = this.banner
    if (cur && cur.priority > priority && cur.life > cur.max * 0.5) return
    const max = opts.dur ?? 1.4
    this.banner = {
      text,
      sub: opts.sub,
      color: opts.color ?? '#fff',
      life: max,
      max,
      size: opts.size ?? 54,
      rainbow: opts.rainbow ?? false,
      priority,
    }
  }

  /** 実時間で進める（ヒットストップ中も演出は動かす） */
  update(dt: number) {
    this.trauma = Math.max(0, this.trauma - dt * 1.4)
    this.flash = Math.max(0, this.flash - dt * 3)
    this.hitstop = Math.max(0, this.hitstop - dt)
    this.slowmo = Math.max(0, this.slowmo - dt)
    for (const p of this.particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      if (p.kind === 'confetti') {
        p.vx *= 0.99
        p.vy = Math.min(p.vy + 60 * dt, 160)
      } else if (p.kind === 'coin') {
        p.vy += 900 * dt
      } else if (p.kind === 'spark' || p.kind === 'star') {
        p.vx *= 0.94
        p.vy = p.vy * 0.94 + 120 * dt
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0)
    for (const p of this.popups) {
      p.life -= dt
      p.y -= 40 * dt
    }
    this.popups = this.popups.filter((p) => p.life > 0)
    if (this.banner) {
      this.banner.life -= dt
      if (this.banner.life <= 0) this.banner = null
    }
  }

  /** ゲームロジックに渡す時間倍率 */
  get timeScale(): number {
    if (this.hitstop > 0) return 0
    if (this.slowmo > 0) return 0.3
    return 1
  }

  shakeOffset(t: number): { x: number; y: number; r: number } {
    const s = this.trauma * this.trauma
    return {
      x: s * 14 * Math.sin(t * 91.3 + 1.7),
      y: s * 14 * Math.sin(t * 77.1 + 4.2),
      r: s * 0.03 * Math.sin(t * 63.7),
    }
  }
}
