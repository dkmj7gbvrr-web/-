/**
 * 画面効果（ジュース）：パーティクル・画面揺れ・フラッシュ・ヒットストップ・スロー・色かぶり・ズーム・ヒビ。
 * 「少ない入力に対して、何倍もの反応を返す」ことを担当する層。
 * 演出は文字（テロップ）を使わず、光・色・形・動き・音だけで語る。
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
  kind: 'spark' | 'confetti' | 'coin' | 'ring' | 'star' | 'shard'
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

/** 画面にヒビが入る演出の1本（中心から外へ伸びる折れ線） */
export interface Crack {
  points: Array<{ x: number; y: number }>
}

export class Fx {
  particles: Particle[] = []
  popups: Popup[] = []
  /** 画面全体の色かぶり（期待度の色・失敗の灰色など） */
  tintColor = '#000'
  tint = 0
  private tintDecay = 1
  /** 一瞬の拡大（手前に迫る感じ） */
  zoom = 0
  /** 画面のヒビ */
  cracks: Crack[] = []
  crackLife = 0
  /** HUD のラウンド数などを脈打たせる残り秒 */
  hudPulse = 0
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

  /** 画面全体を color に染め、dur 秒かけて戻す */
  doTint(color: string, strength: number, dur = 1) {
    this.tintColor = color
    this.tint = Math.max(this.tint, strength * (this.reducedMotion ? 0.5 : 1))
    this.tintDecay = strength / Math.max(0.05, dur)
  }

  /** 画面が一瞬手前に迫る */
  punch(amount: number) {
    this.zoom = Math.max(this.zoom, amount * (this.reducedMotion ? 0.3 : 1))
  }

  /** 矩形の縁がガラスのように砕け散る（言葉を使わずに「ダメだった」を伝える） */
  shatterRect(x: number, y: number, w: number, h: number, colors: string[], n = 70) {
    for (let i = 0; i < n; i++) {
      // 縁の上のランダムな点
      const side = Math.floor(Math.random() * 4)
      const u = Math.random()
      const px = side === 0 || side === 2 ? x + u * w : side === 1 ? x + w : x
      const py = side === 1 || side === 3 ? y + u * h : side === 2 ? y + h : y
      const max = 0.8 + Math.random() * 0.6
      this.particles.push({
        x: px,
        y: py,
        vx: (px - (x + w / 2)) * 1.2 + (Math.random() - 0.5) * 120,
        vy: -120 + Math.random() * 140,
        life: max,
        max,
        size: 4 + Math.random() * 9,
        color: colors[Math.floor(Math.random() * colors.length)],
        kind: 'shard',
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 16,
      })
    }
  }

  /** 画面にヒビが走る（cx, cy から放射状） */
  crack(cx: number, cy: number, dur = 1.6) {
    this.cracks = []
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4
      const points = [{ x: cx, y: cy }]
      let x = cx
      let y = cy
      const len = 160 + Math.random() * 220
      for (let d = 0; d < len; d += 24 + Math.random() * 20) {
        const aa = a + (Math.random() - 0.5) * 0.6
        x += Math.cos(aa) * 30
        y += Math.sin(aa) * 30
        points.push({ x, y })
      }
      this.cracks.push({ points })
    }
    this.crackLife = dur
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
      } else if (p.kind === 'coin' || p.kind === 'shard') {
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
    this.tint = Math.max(0, this.tint - this.tintDecay * dt)
    this.zoom = Math.max(0, this.zoom - dt * 0.6)
    this.crackLife = Math.max(0, this.crackLife - dt)
    this.hudPulse = Math.max(0, this.hudPulse - dt)
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
