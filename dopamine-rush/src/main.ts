import './style.css'
import { AdSenseRewardProvider, configureAdSense, loadAdSense } from './ads/adsense'
import { AD_CLIENT, AD_FREQUENCY_HINT, AD_TEST } from './ads/config'
import { resolveOwner } from './ads/owner'
import { RefillGate } from './ads/refillGate'
import { Fx } from './fx'
import { audio } from './game/audio'
import { Game, holdLevel, type GameEvent } from './game/game'
import { SIGN_COLORS, type HoldColor, type SignColor } from './game/odds'
import { BOARD_BOTTOM, H, W } from './game/physics'
import { mulberry32 } from './game/rng'
import { BTN_MOTION, BTN_MUTE, BTN_REFILL, render, type Ui } from './render'

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const ctx = canvas.getContext('2d')!

const STORAGE_KEY = 'dopamine-rush:v1'
interface Saved {
  muted: boolean
  reducedMotion: boolean
  best: { chain: number; total: number }
}
function load(): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Saved>
  } catch {
    return {}
  }
}
function save() {
  try {
    const s: Saved = { muted: ui.muted, reducedMotion: ui.reducedMotion, best: ui.best }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // 保存できなくても遊べる
  }
}

const saved = load()
const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const ui: Ui = {
  gate: { kind: 'free' },
  owner: false,
  started: false,
  muted: saved.muted ?? false,
  reducedMotion: saved.reducedMotion ?? prefersReduced,
  displayBalls: 0,
  best: saved.best ?? { chain: 0, total: 0 },
  displayPayout: 0,
}
const fx = new Fx()
fx.reducedMotion = ui.reducedMotion
audio.muted = ui.muted

const HOLD_COLOR_CSS: Record<HoldColor, string> = {
  white: '#ffffff',
  blue: '#3d8bff',
  green: '#27d17f',
  red: '#ff3355',
  gold: '#ffd23d',
  rainbow: '#ffffff',
}
const SIGN_CSS: Record<SignColor, string> = {
  white: '#ffffff',
  blue: '#3d8bff',
  green: '#27d17f',
  red: '#ff3355',
  gold: '#ffd23d',
  rainbow: '#ffffff',
}
const signLevel = (c: SignColor) => SIGN_COLORS.indexOf(c)
const RAINBOW = ['#ff3b3b', '#ffa53d', '#ffe23d', '#3ddc84', '#39c0ff', '#b77dff', '#ff6fb5']

let lastPegSound = 0
let attackerCount = 0
let clock = 0

/** 図柄パネルの位置（演出の中心） */
const PANEL = { x: 26, y: 58, w: W - 52, h: 156, cx: W / 2, cy: 136 }
const BUTTON = { x: W / 2, y: 600, r: 58 }
const GRAY = ['#8890a8', '#5a6078', '#c0c6d8']

function onEvent(e: GameEvent) {
  switch (e.type) {
    case 'peg': {
      if (clock - lastPegSound > 0.03) {
        audio.peg(e.ball.hits - 1)
        lastPegSound = clock
      }
      if (!e.ball.free || Math.random() < 0.3) fx.burst(e.peg.x, e.peg.y, 3, ['#9ff', '#fff'], 90)
      break
    }
    case 'gold':
      audio.gold()
      fx.burst(e.peg.x, e.peg.y, 18, ['#ffd23d', '#fff3b0', '#fff'], 200, 'star')
      fx.ring(e.peg.x, e.peg.y, '#ffd23d', 40)
      fx.popup(e.peg.x, e.peg.y - 8, '+1', '#ffd23d', 16)
      if (e.split) {
        // 玉が分裂：金の衝撃波が二重に広がる
        fx.ring(e.peg.x, e.peg.y, '#ffd23d', 90)
        fx.ring(e.peg.x, e.peg.y, '#fff3b0', 140)
        fx.punch(0.03)
        fx.shake(0.25)
        audio.levelUp()
      }
      break
    case 'pocket':
      if (e.kind === 'start') {
        audio.startPocket()
        fx.burst(e.x, BOARD_BOTTOM + 10, 20, ['#ffdd33', '#fff'], 260)
        fx.ring(e.x, BOARD_BOTTOM + 10, '#ffdd33', 50)
        fx.popup(e.x, BOARD_BOTTOM - 10, `+${e.payout}`, '#ffdd33', 18)
      } else if (e.kind === 'bonus') {
        audio.bonusPocket(e.payout)
        fx.burst(e.x, BOARD_BOTTOM + 10, 8, ['#8ff', '#fff'], 160)
        fx.popup(e.x, BOARD_BOTTOM - 10, `+${e.payout}`, '#bfefff', 15)
      }
      break
    case 'holdAdded': {
      const lvl = holdLevel(e.color)
      if (lvl >= 3) {
        audio.holdChange(lvl)
        fx.shake(0.1 * lvl)
      }
      break
    }
    case 'holdChange': {
      // 当該保留が弾けて色が変わる
      const lvl = holdLevel(e.to)
      const colors = e.to === 'rainbow' ? RAINBOW : [HOLD_COLOR_CSS[e.to], '#fff']
      audio.holdChange(lvl)
      fx.doFlash(0.25 + lvl * 0.08, HOLD_COLOR_CSS[e.to])
      fx.burst(262, 236, 30 + lvl * 8, colors, 220, 'star')
      fx.ring(262, 236, HOLD_COLOR_CSS[e.to], 50 + lvl * 12)
      fx.shake(0.12 + lvl * 0.05)
      if (e.to === 'rainbow') audio.kakutei()
      break
    }
    case 'kakutei':
      audio.kakutei()
      fx.doFlash(1)
      fx.stop(0.3)
      fx.shake(0.5)
      fx.rainbow = 0.25
      break
    case 'reelStop':
      audio.reelStop(e.heavy)
      fx.shake(e.heavy ? 0.18 : 0.06)
      break
    case 'reach': {
      // リーチ：パネルの枠がタイトル色に灯り、左右の図柄が光の線で結ばれる（描画側）
      const lvl = signLevel(e.title)
      audio.reach()
      fx.punch(0.04 + lvl * 0.01)
      fx.doTint(SIGN_CSS[e.title], 0.12 + lvl * 0.04, 1.2)
      fx.ring(PANEL.cx, PANEL.cy, SIGN_CSS[e.title], 180)
      fx.shake(0.2 + lvl * 0.05)
      if (lvl >= 4) fx.doFlash(0.4, SIGN_CSS[e.title])
      break
    }
    case 'stepUp':
      audio.stepUp(e.step, e.final)
      fx.shake(0.05 * e.step)
      fx.ring(W / 2, 470, e.step >= 5 ? '#ffd23d' : '#ffffff', 60 + e.step * 25)
      if (e.step >= 4) fx.doFlash(0.15 * (e.step - 3), e.step >= 5 ? '#ffd23d' : '#ff3355')
      break
    case 'gijiren':
      // 擬似連：パネルから衝撃波が回数ぶん広がる（下のランプの数でも分かる）
      audio.gijiren(e.count)
      for (let i = 0; i < e.count; i++) fx.ring(PANEL.cx, PANEL.cy, e.count >= 3 ? '#ff3355' : '#39e0e0', 120 + i * 70)
      fx.doFlash(0.3, '#39e0e0')
      fx.punch(0.03 * e.count)
      fx.shake(0.15 * e.count)
      break
    case 'zone':
      // 先読みゾーン：盤面の両脇に紫の炎が立ち、回を重ねるごとに高くなる（描画側）
      audio.zone(e.count, e.target)
      fx.doTint(e.target ? '#ff3355' : '#7a2cff', e.target ? 0.3 : 0.18, 0.9)
      if (e.target) fx.punch(0.05)
      break
    case 'cutin':
      audio.cutin(signLevel(e.color))
      fx.shake(0.2 + signLevel(e.color) * 0.1)
      fx.doFlash(0.25 + signLevel(e.color) * 0.1, SIGN_CSS[e.color])
      fx.punch(0.03 + signLevel(e.color) * 0.01)
      if (e.color === 'rainbow') fx.confettiRain(80, W)
      break
    case 'blackoutReveal':
      audio.kakutei()
      audio.impact()
      fx.doFlash(1)
      fx.stop(0.3)
      fx.shake(1)
      fx.punch(0.08)
      fx.ring(PANEL.cx, PANEL.cy, '#ffffff', 260)
      fx.burst(PANEL.cx, PANEL.cy, 90, RAINBOW, 460, 'star')
      break
    case 'over':
      audio.over(e.count)
      fx.burst(e.x, BOARD_BOTTOM, 14, ['#ff6fb5', '#ffffff', '#ffd23d'], 260, 'star')
      fx.ring(e.x, BOARD_BOTTOM, '#ff6fb5', 50)
      fx.popup(e.x, BOARD_BOTTOM - 24, `+${e.payout}`, '#ff6fb5', 20)
      fx.shake(0.12)
      break
    case 'luckyTrigger':
      // 画面が金色に染まり、金の粒が降り注ぐ（続く上位 RUSH 導入画面も描画側）
      audio.playMusic(null)
      audio.luckyTrigger()
      fx.doFlash(1, '#ffd23d')
      fx.doTint('#ffb800', 0.45, 3)
      fx.stop(0.4)
      fx.shake(1)
      fx.punch(0.1)
      fx.confettiRain(260, W)
      fx.burst(W / 2, 300, 120, ['#ffd23d', '#fff3b0', '#ffffff', '#ffb800'], 480, 'star')
      break
    case 'escalate':
      if (e.reach === 'premium') {
        audio.riser(1.4, 1.4)
        fx.doFlash(0.7)
        fx.shake(0.45)
        fx.punch(0.06)
        fx.rainbow = 0.2
        fx.confettiRain(60, W)
      } else {
        // SUPER：画面が赤く沈み、パネルが迫る
        audio.riser(2.2)
        fx.doFlash(0.35, '#ff3355')
        fx.doTint('#ff1030', 0.25, 1.6)
        fx.punch(0.05)
        fx.shake(0.3)
      }
      break
    case 'pushPrompt':
      audio.tone(880, 0.12, { type: 'square', gain: 0.08 })
      audio.tone(1320, 0.18, { type: 'square', gain: 0.08, delay: 0.12 })
      fx.ring(BUTTON.x, BUTTON.y, '#ff3355', 110)
      break
    case 'pushed':
      audio.impact()
      fx.stop(0.2)
      fx.shake(0.4)
      fx.punch(0.05)
      fx.ring(BUTTON.x, BUTTON.y, '#ffffff', 160)
      fx.doFlash(e.win ? 0.9 : 0.4)
      break
    case 'revival':
      audio.kakutei()
      audio.impact()
      fx.doFlash(1)
      fx.stop(0.25)
      fx.shake(0.8)
      fx.punch(0.08)
      fx.ring(PANEL.cx, PANEL.cy, '#ffffff', 240)
      fx.burst(PANEL.cx, PANEL.cy, 60, RAINBOW, 400, 'star')
      fx.confettiRain(80, W)
      break
    case 'develop':
      // SUPER に上がるか：パネルの枠が赤と金で激しく明滅（描画側）＋縁から火花
      audio.develop()
      fx.shake(0.25)
      fx.doTint('#ffb800', 0.15, 1.1)
      fx.burst(PANEL.x, PANEL.cy, 20, ['#ffd23d', '#ff3355'], 220)
      fx.burst(PANEL.x + PANEL.w, PANEL.cy, 20, ['#ffd23d', '#ff3355'], 220)
      break
    case 'developResult':
      if (e.success) {
        fx.doFlash(0.6, '#ffd23d')
        fx.stop(0.12)
      } else {
        // 上がらなかった：パネルの枠がガラスのように砕け、画面が一瞬くすむ
        audio.shatter()
        fx.shatterRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, ['#ffd23d', '#ff3355', '#ffffff'])
        fx.doTint('#30334a', 0.35, 0.8)
        fx.shake(0.25)
      }
      break
    case 'rendaStart':
      audio.startPocket()
      audio.riser(2.4, 0.9)
      fx.doFlash(0.3, '#ff3355')
      fx.ring(BUTTON.x, BUTTON.y, '#ff3355', 140)
      break
    case 'rendaTap':
      audio.rendaTap(e.count)
      fx.shake(0.06)
      fx.ring(BUTTON.x, BUTTON.y, `hsl(${(e.count * 37) % 360},100%,65%)`, 90 + Math.min(e.count, 30) * 3)
      fx.burst(BUTTON.x + (Math.random() - 0.5) * 160, BUTTON.y + (Math.random() - 0.5) * 60, 6, RAINBOW, 180, 'star')
      break
    case 'crawlStep':
      audio.crawl(e.slow, e.last)
      fx.shake(e.last ? 0.3 : e.slow ? 0.12 : 0.04)
      if (e.last) fx.stop(0.08)
      break
    case 'darkPause':
      audio.drone(1.6)
      fx.rainbow = 0
      break
    case 'slip':
      audio.kakutei()
      audio.impact()
      fx.doFlash(1)
      fx.stop(0.2)
      fx.shake(0.8)
      fx.punch(0.07)
      fx.ring(PANEL.cx, PANEL.cy, '#ffffff', 220)
      break
    case 'fakeAlign':
      audio.tease()
      fx.doFlash(0.55)
      fx.shake(0.35)
      fx.rainbow = 0.25
      fx.burst(W / 2, 140, 30, RAINBOW, 260, 'star')
      break
    case 'fakeAlignBreak':
      audio.fall()
      fx.rainbow = 0
      fx.doTint('#30334a', 0.35, 0.9)
      fx.shake(0.55)
      fx.stop(0.15)
      break
    case 'fakeRevivalEnd':
      audio.tone(300, 0.6, { type: 'triangle', gain: 0.05, slideTo: 140 })
      fx.doTint('#30334a', 0.3, 0.8)
      break
    case 'blackout':
      // 大当たり確定のブラックアウト：画面を落として無音にし、うっすら「歓喜の歌」
      fx.rainbow = 0
      window.setTimeout(() => audio.odeWhisper(), 900)
      break
    case 'darken':
      fx.rainbow = 0
      break
    case 'darkenEnd':
      if (e.win) {
        audio.kakutei()
        audio.impact()
        fx.doFlash(1)
        fx.stop(0.25)
        fx.shake(0.9)
        fx.punch(0.07)
      } else {
        audio.reelStop(true)
        fx.doTint('#30334a', 0.3, 0.8)
        fx.shake(0.2)
      }
      break
    case 'miss':
      audio.miss()
      fx.rainbow = 0
      break
    case 'jackpot':
      // 大当たり：ヒットストップ → 白飛び → 図柄から虹の衝撃波と星、紙吹雪、画面が迫る
      audio.fanfare()
      fx.stop(0.35)
      fx.doFlash(1)
      fx.shake(1)
      fx.punch(0.12)
      fx.rainbow = 0
      fx.confettiRain(160, W)
      fx.burst(PANEL.cx, PANEL.cy, 80, RAINBOW, 420, 'star')
      for (let i = 0; i < 3; i++) fx.ring(PANEL.cx, PANEL.cy, RAINBOW[i * 2], 200 + i * 90)
      ui.displayPayout = 0
      attackerCount = 0
      window.setTimeout(() => audio.playMusic('fever', 150 + Math.min(40, e.chain * 5)), 1200)
      break
    case 'roundStart':
      // ラウンド開始：アタッカーが開く瞬間に金の衝撃波
      fx.ring(W / 2, BOARD_BOTTOM + 18, '#ffd23d', 160)
      fx.hudPulse = 0.5
      break
    case 'attackerIn':
      attackerCount++
      audio.countTick(attackerCount)
      fx.burst(e.x, BOARD_BOTTOM, 6, ['#ffd23d', '#ffb800', '#fff3b0'], 200, 'coin')
      fx.popup(e.x, BOARD_BOTTOM - 14, `+${e.payout}`, '#ffd23d', 17)
      fx.shake(0.04)
      break
    case 'upgrade':
      // ラウンド昇格：HUD のラウンド数が虹色に脈打つ（描画側）
      audio.levelUp()
      audio.kakutei()
      fx.hudPulse = 2
      fx.doFlash(0.9)
      fx.stop(0.25)
      fx.shake(0.7)
      fx.punch(0.06)
      fx.ring(W / 2, 30, '#ffffff', 200)
      fx.confettiRain(120, W)
      break
    case 'feverEnd':
      // 獲得数の表示からコインが噴き上がる
      fx.burst(W / 2, 330, 40 + Math.min(80, Math.round(e.payout / 20)), ['#ffd23d', '#ffb800', '#fff3b0'], 320, 'coin')
      audio.levelUp()
      updateBest(game.chain, game.chainTotal)
      break
    case 'challengeStart':
      audio.playMusic(null)
      audio.riser(3.2, 1.2)
      break
    case 'challengeResult':
      if (e.success) {
        // ゲージが虹色に満ちて弾ける
        audio.fanfare()
        audio.kakutei()
        fx.doFlash(1)
        fx.stop(0.3)
        fx.shake(1)
        fx.punch(0.1)
        fx.doTint('#ff4df0', 0.3, 2)
        fx.burst(W / 2, 401, 120, RAINBOW, 480, 'star')
        fx.confettiRain(200, W)
      } else {
        // ゲージが砕け、画面が灰色にくすむ
        audio.shatter()
        audio.miss()
        fx.shatterRect(60, 390, W - 120, 22, ['#ff3355', ...GRAY], 90)
        fx.doTint('#30334a', 0.5, 1.8)
      }
      break
    case 'rushStart':
      audio.playMusic('rush', Math.min(210, (e.lt ? 160 : 138) + e.chain * 6))
      fx.doFlash(0.5, e.lt ? '#ffd23d' : '#ff4df0')
      fx.ring(W / 2, 30, e.lt ? '#ffd23d' : '#ff4df0', 220)
      fx.hudPulse = 1
      break
    case 'lastChance':
      // 復活チャンス：画面にヒビが走り、金色のボタンがせり上がる
      audio.kakutei()
      audio.develop()
      fx.crack(BUTTON.x, BUTTON.y, 1.8)
      fx.doFlash(0.7, '#ff3355')
      fx.doTint('#ffb800', 0.2, 1.5)
      fx.stop(0.15)
      fx.shake(0.5)
      fx.punch(0.05)
      break
    case 'lastChanceFail':
      // ボタンが砕け散る
      audio.shatter()
      audio.fall()
      fx.shatterRect(BUTTON.x - BUTTON.r, BUTTON.y - BUTTON.r, BUTTON.r * 2, BUTTON.r * 2, ['#ffd23d', ...GRAY], 90)
      fx.doTint('#30334a', 0.45, 1.4)
      fx.shake(0.3)
      break
    case 'lastSpin':
      // 最終変動：画面の縁が赤く脈打つ（描画側）
      audio.heartbeat()
      fx.doTint('#ff1030', 0.25, 1.2)
      fx.shake(0.3)
      break
    case 'rushEnd':
      audio.playMusic(null)
      audio.levelUp()
      updateBest(e.chain, e.total)
      break
    case 'refill':
      fx.ring(W / 2, 32, '#3ddc84', 120)
      fx.burst(60, 36, 40, ['#3ddc84', '#ffffff'], 200, 'coin')
      audio.levelUp()
      break
  }
}

function updateBest(chain: number, total: number) {
  let changed = false
  if (chain > ui.best.chain) {
    ui.best.chain = chain
    changed = true
  }
  if (total > ui.best.total) {
    ui.best.total = total
    changed = true
  }
  if (changed) save()
}

const game = new Game(mulberry32((Math.random() * 2 ** 32) >>> 0), onEvent)

// ---------------------------------------------------------------- 補給（リワード広告）

const grant = (amount: number) => game.refill(amount)
/** 広告が未設定なら、これまでどおり無料で補給できる */
let gate = new RefillGate(null, grant)
let adsLoaded = false
// URL の ?owner= は広告の設定に関係なく読み取って消す
void resolveOwner()
  .catch(() => false)
  .then((owner) => {
    ui.owner = owner
    if (owner || !AD_CLIENT) return
    loadAdSense(AD_CLIENT, { test: AD_TEST, frequencyHint: AD_FREQUENCY_HINT })
    configureAdSense(!ui.muted)
    adsLoaded = true
    gate = new RefillGate(new AdSenseRewardProvider(), grant)
  })
ui.displayBalls = game.balls

// ---------------------------------------------------------------- 入力

function toLogical(ev: PointerEvent) {
  const r = canvas.getBoundingClientRect()
  return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H }
}
const inside = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
  p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h

canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault()
  canvas.setPointerCapture(ev.pointerId)
  audio.unlock()
  const p = toLogical(ev)
  if (!ui.started) {
    ui.started = true
    return
  }
  if (inside(p, BTN_MUTE)) {
    ui.muted = !ui.muted
    audio.setMuted(ui.muted)
    if (adsLoaded) configureAdSense(!ui.muted)
    save()
    return
  }
  if (inside(p, BTN_MOTION)) {
    ui.reducedMotion = !ui.reducedMotion
    fx.reducedMotion = ui.reducedMotion
    save()
    return
  }
  if (game.rendaActive) {
    game.tap()
    return
  }
  if (game.pushPending) {
    game.push()
    return
  }
  if (game.needsRefill && inside(p, BTN_REFILL)) {
    gate.press()
    return
  }
  game.aimX = p.x
  game.firing = true
})
canvas.addEventListener('pointermove', (ev) => {
  if (!ui.started) return
  game.aimX = toLogical(ev).x
})
const release = () => {
  game.firing = false
}
canvas.addEventListener('pointerup', release)
canvas.addEventListener('pointercancel', release)
window.addEventListener('blur', release)
window.addEventListener('keydown', (ev) => {
  if (ev.code !== 'Space' || ev.repeat) return
  ev.preventDefault()
  audio.unlock()
  if (!ui.started) ui.started = true
  else if (game.rendaActive) game.tap()
  else if (game.pushPending) game.push()
  else game.firing = true
})
window.addEventListener('keyup', (ev) => {
  if (ev.code === 'Space') game.firing = false
})

// ---------------------------------------------------------------- 画面サイズ

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H)
  canvas.style.width = `${Math.floor(W * scale)}px`
  canvas.style.height = `${Math.floor(H * scale)}px`
  canvas.width = Math.floor(W * scale * dpr)
  canvas.height = Math.floor(H * scale * dpr)
  ctx.setTransform((canvas.width / W), 0, 0, canvas.height / H, 0, 0)
}
window.addEventListener('resize', resize)
resize()

// ---------------------------------------------------------------- ループ

let prev = performance.now()
let tickTimer = 0
let heartTimer = 0

function frame(now: number) {
  const dt = Math.min(0.05, (now - prev) / 1000)
  prev = now
  clock += dt
  fx.update(dt)
  gate.update(dt, game.needsRefill)
  ui.gate = gate.state
  if (gate.paused) {
    // 広告の再生中はゲームを止めて消音する
    game.firing = false
    audio.suspend()
  } else if (ui.started) {
    audio.resume()
    game.update(dt * fx.timeScale)

    // 回転中のリールの刻み音
    // 暗転・タメの間は BGM と刻み音を止めて「無音」で溜める
    const silent = !!game.spin && (game.spin.blackout || game.spin.darken || game.spin.dark)
    // 違和感：RUSH 中に BGM が途切れる / リールの刻み音が鳴らない
    const iw = game.spin?.outcome.iwakan
    const musicGap = iw === 'musicStop' && (game.spin?.t ?? 9) < 1.6
    audio.duck(silent || musicGap)
    const spinning = !silent && iw !== 'silentStart' && game.reels.some((r) => !r.stopped && !r.stopping)
    tickTimer -= dt
    if (spinning && tickTimer <= 0) {
      audio.reelTick()
      tickTimer = game.spin && game.spin.stage !== 'rolling' ? 0.16 : 0.07
    }
    // リーチ中・チャレンジ中の心音：期待度が上がるほど速くなる
    const tense = (game.spin && game.spin.stage !== 'rolling' && !game.spin.done) || (game.scene === 'challenge' && game.challengeResult === null)
    heartTimer -= dt
    if (tense && !game.spin?.blackout && !game.spin?.darken && heartTimer <= 0) {
      audio.heartbeat()
      const gauge = game.spin?.gauge ?? Math.min(1, game.sceneTime / 3.2) * 0.8
      heartTimer = 0.95 - gauge * 0.5
    }
    if (!tense && fx.rainbow > 0 && !game.spin) fx.rainbow = Math.max(0, fx.rainbow - dt * 0.2)

    ui.displayBalls += (game.balls - ui.displayBalls) * Math.min(1, dt * 10)
    if (Math.abs(game.balls - ui.displayBalls) < 0.5) ui.displayBalls = game.balls
    const target = game.fever?.payout ?? ui.displayPayout
    ui.displayPayout += (target - ui.displayPayout) * Math.min(1, dt * 8)
  }
  ctx.save()
  ctx.clearRect(0, 0, W, H)
  render(ctx, game, fx, ui, clock)
  ctx.restore()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

