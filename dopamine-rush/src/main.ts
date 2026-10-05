import './style.css'
import { AdSenseRewardProvider, configureAdSense, loadAdSense } from './ads/adsense'
import { AD_CLIENT, AD_FREQUENCY_HINT, AD_TEST } from './ads/config'
import { resolveOwner } from './ads/owner'
import { RefillGate } from './ads/refillGate'
import { Chara, stageForChain, type Stage } from './chara'
import { Fx } from './fx'
import { isOutdated, reloadToLatest } from './version'
import { audio } from './game/audio'
import { Game, holdLevel, type GameEvent } from './game/game'
import { CUSTOMS, POCHI_ACTION, POCHI_ITEM, POCHI_WHERE, SIGN_COLORS, type Custom, type HoldColor, type SignColor } from './game/odds'
import { BOARD_BOTTOM, H, W } from './game/physics'
import { mulberry32 } from './game/rng'
import { BTN_AUTO, BTN_CUSTOM, BTN_MOTION, BTN_MUTE, BTN_REFILL, CHARA_X, CHARA_Y, HANDLE, HANDLE_SWEEP, holdX, render, type Ui } from './render'

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const ctx = canvas.getContext('2d')!

const STORAGE_KEY = 'dopamine-rush:v1'
interface Saved {
  muted: boolean
  reducedMotion: boolean
  best: { chain: number; total: number }
  custom: Custom
  autoFire: boolean
  strength: number
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
    const s: Saved = {
      muted: ui.muted,
      reducedMotion: ui.reducedMotion,
      best: ui.best,
      custom: ui.custom,
      autoFire: ui.autoFire,
      strength: game.strength,
    }
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
  custom: CUSTOMS.includes(saved.custom as Custom) ? (saved.custom as Custom) : 'standard',
  autoFire: saved.autoFire ?? false,
}
const fx = new Fx()
const chara = new Chara()
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
/** ポッチの炎の色（期待度の色）。'rainbow' は虹 */
const SIGN_RGB: Record<SignColor, string> = {
  white: 'rgb(255,200,120)',
  blue: 'rgb(80,150,255)',
  green: 'rgb(60,220,130)',
  red: 'rgb(255,60,80)',
  gold: 'rgb(255,210,60)',
  rainbow: 'rainbow',
}
const HOLD_RGB: Record<HoldColor, string> = SIGN_RGB
const RAINBOW = ['#ff3b3b', '#ffa53d', '#ffe23d', '#3ddc84', '#39c0ff', '#b77dff', '#ff6fb5']

let lastPegSound = 0
let chargeTick = 0
let lastStage: Stage = 1
/** ポッチの成長段階：通常時は殻から顔を出した状態、連チャンするほど育つ */
function charaStage(): Stage {
  const inChain = game.phase === 'rush' || (game.phase === 'fever' && game.chain > 0) || game.scene === 'ltIntro'
  return inChain ? stageForChain(game.chain, game.lt) : 1
}
let attackerCount = 0
let clock = 0

/** 図柄パネルの位置（演出の中心） */
const PANEL = { x: 26, y: 58, w: W - 52, h: 156, cx: 165, cy: 136 }
const BUTTON = { x: W / 2, y: 600, r: 58 }
/** リーチ舞台のクリスタルの位置（render.ts の drawReachStage と同じ） */
const STAGE_EGG = { x: 330, y: 470 }
const GRAY = ['#8890a8', '#5a6078', '#c0c6d8']

function onEvent(e: GameEvent) {
  switch (e.type) {
    case 'peg': {
      if (clock - lastPegSound > 0.03) {
        audio.peg(e.ball.hits - 1)
        lastPegSound = clock
      }
      // リーチ舞台が出ている間は盤面が空に変わっているので、釘の火花は出さない
      if (chara.reachK < 0.5 && (!e.ball.free || Math.random() < 0.3)) fx.burst(e.peg.x, e.peg.y, 3, ['#9ff', '#fff'], 90)
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
        chara.hop = 1
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
        chara.react('hype', 0.8)
        audio.holdChange(lvl)
        fx.shake(0.1 * lvl)
      }
      break
    }
    case 'holdChange': {
      // 保留が弾けて色が変わる（index -1 は変動中の保留）
      const lvl = holdLevel(e.to)
      const colors = e.to === 'rainbow' ? RAINBOW : [HOLD_COLOR_CSS[e.to], '#fff']
      const hx = holdX(e.index)
      audio.holdChange(lvl)
      fx.doFlash((0.25 + lvl * 0.08) * (e.index < 0 ? 1 : 0.5), HOLD_COLOR_CSS[e.to])
      fx.burst(hx, 236, 30 + lvl * 8, colors, 220, 'star')
      fx.ring(hx, 236, HOLD_COLOR_CSS[e.to], 50 + lvl * 12)
      chara.breathe(HOLD_RGB[e.to], 0.4 + lvl * 0.1, 0.8)
      chara.react(lvl >= 3 ? 'hype' : 'idle', 0.8)
      fx.shake(0.12 + lvl * 0.05)
      if (e.to === 'rainbow') audio.kakutei()
      break
    }
    case 'sakibare':
      // 先バレ：入賞の瞬間に甲高い告知音と、盤面の縁が一瞬虹色に光る
      audio.sakibare()
      chara.react('joy', 0.8)
      fx.doFlash(0.5)
      fx.doTint('#ffffff', 0.15, 0.4)
      fx.rainbow = 0.3
      fx.ring(W / 2, BOARD_BOTTOM + 10, '#ffffff', 220)
      fx.shake(0.3)
      break
    case 'pochi': {
      // ポッチ予告：場所・行動・持ち物が上位なほど声も演出も強い
      const tell = e.tell
      chara.showTell(tell)
      const lvl =
        POCHI_WHERE.indexOf(tell.where) + POCHI_ACTION.indexOf(tell.action) + Math.min(3, POCHI_ITEM.indexOf(tell.item))
      if (tell.where === 'giant') {
        audio.pochiVoice('roar')
        fx.punch(0.08)
        fx.shake(0.7)
        fx.doFlash(0.4)
      } else audio.pochiVoice(lvl >= 5 ? 'excited' : lvl >= 2 ? 'happy' : 'chirp')
      if (tell.where === 'onReel') window.setTimeout(() => fx.shake(0.35), 300)
      if (tell.item === 'rainbowEgg') {
        audio.kakutei()
        fx.doFlash(0.8)
        fx.rainbow = 0.3
      } else if (tell.item === 'crown') {
        audio.gold()
        fx.doFlash(0.4, '#ffd23d')
      }
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
      audio.pochiVoice('chirp')
      chara.react('hype', 2.5)
      chara.breathe(SIGN_RGB[e.title], 0.35 + lvl * 0.1, 1)
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
      chara.wobble = e.target ? 1 : 0.6
      fx.doTint(e.target ? '#ff3355' : '#7a2cff', e.target ? 0.3 : 0.18, 0.9)
      if (e.target) fx.punch(0.05)
      break
    case 'cutin':
      audio.cutin(signLevel(e.color))
      // SUPER 以上はポッチが舞台の主役（中央への飛び出しはしない）
      chara.react('hype', 1.3)
      chara.breathe(SIGN_RGB[e.color], 0.6 + signLevel(e.color) * 0.1, 1.3)
      fx.shake(0.2 + signLevel(e.color) * 0.1)
      fx.doFlash(0.25 + signLevel(e.color) * 0.1, SIGN_CSS[e.color])
      fx.punch(0.03 + signLevel(e.color) * 0.01)
      if (e.color === 'rainbow') fx.confettiRain(80, W)
      break
    case 'blackoutReveal':
      chara.center(1.4)
      chara.react('joy', 2)
      chara.breathe('rainbow', 1, 1.4)
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
      window.setTimeout(() => audio.pochiVoice('roar'), 500)
      chara.center(4)
      chara.react('joy', 4)
      chara.breathe('rgb(255,210,60)', 1, 4)
      fx.doFlash(1, '#ffd23d')
      fx.doTint('#ffb800', 0.45, 3)
      fx.stop(0.4)
      fx.shake(1)
      fx.punch(0.1)
      fx.confettiRain(260, W)
      fx.burst(W / 2, 300, 120, ['#ffd23d', '#fff3b0', '#ffffff', '#ffb800'], 480, 'star')
      break
    case 'escalate':
      chara.react('hype', 1.6)
      if (e.reach === 'premium') {
        chara.breathe('rainbow', 1, 1.4)
        audio.riser(1.4, 1.4)
        fx.doFlash(0.7)
        fx.shake(0.45)
        fx.punch(0.06)
        fx.rainbow = 0.2
        fx.confettiRain(60, W)
      } else {
        // SUPER：画面が赤く沈み、パネルが迫る
        chara.breathe(SIGN_RGB.red, 0.8, 1.4)
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
      // リーチ舞台ではポッチがクリスタルへ炎のビームを放つ
      if (chara.reachK > 0.3) chara.fireBeam(e.charge > 0.7 ? 'rainbow' : '#ffd2a0')
      // 溜めたぶんだけ、離した瞬間の衝撃が大きい
      audio.impact()
      fx.stop(0.15 + e.charge * 0.15)
      fx.shake(0.4 + e.charge * 0.5)
      fx.punch(0.05 + e.charge * 0.07)
      fx.ring(BUTTON.x, BUTTON.y, '#ffffff', 160 + e.charge * 140)
      if (e.charge > 0.3) fx.burst(BUTTON.x, BUTTON.y, Math.round(40 * e.charge), RAINBOW, 380, 'star')
      fx.doFlash((e.win ? 0.9 : 0.4) + e.charge * 0.3)
      break
    case 'revival':
      chara.center(1)
      chara.react('joy', 1.5)
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
      chara.react('hype', 1.2)
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
        chara.react('sad', 0.9)
        audio.shatter()
        fx.shatterRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, ['#ffd23d', '#ff3355', '#ffffff'])
        fx.doTint('#30334a', 0.35, 0.8)
        fx.shake(0.25)
      }
      break
    case 'chargeStart':
      // 長押しの溜め開始：ポッチが息を吸い込む
      chara.react('hype', 3)
      fx.ring(BUTTON.x, BUTTON.y, '#ffffff', 90)
      chargeTick = 0
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
      chara.react('joy', 1.2)
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
      chara.react('sad', 0.9)
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
      if (e.reach !== 'none') chara.react('sad', 0.6)
      if (chara.reachK > 0.3) {
        // リーチ舞台の決着：炎が弾かれ、クリスタルが揺れる
        chara.crystal = -1
        chara.react('sad', 0.9)
        audio.pochiVoice('sad')
        fx.burst(STAGE_EGG.x - 30, STAGE_EGG.y, 30, GRAY, 260, 'spark')
      }
      audio.miss()
      fx.rainbow = 0
      break
    case 'jackpot':
      // 大当たり：ヒットストップ → 白飛び → 図柄から虹の衝撃波と星、紙吹雪、画面が迫る
      if (chara.reachK > 0.3) {
        // リーチ舞台の決着：クリスタルが虹色に砕け、少し遅れてポッチが中央へ
        chara.crystal = 1
        fx.burst(STAGE_EGG.x, STAGE_EGG.y, 90, RAINBOW, 480, 'star')
        fx.ring(STAGE_EGG.x, STAGE_EGG.y, '#ffffff', 220)
        window.setTimeout(() => chara.center(2), 650)
      } else chara.center(2.4)
      chara.react('joy', 3)
      chara.breathe('rainbow', 1, 2.4)
      window.setTimeout(() => audio.pochiVoice('excited'), 400)
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
        chara.center(1.6)
        chara.react('joy', 2)
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
        chara.react('sad', 2)
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
      chara.react('hype', 4)
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
      chara.react('sad', 1.5)
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
    case 'launch':
      audio.launch(game.strength)
      break
    case 'foul':
      audio.foul()
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
game.custom = ui.custom

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
if (typeof saved.strength === 'number' && Number.isFinite(saved.strength)) game.strength = clampStrength(saved.strength)

// ---------------------------------------------------------------- 入力

function toLogical(ev: PointerEvent) {
  const r = canvas.getBoundingClientRect()
  return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H }
}
/** ハンドルの指の角度（中心に近すぎると角度が定まらないので null） */
let grabbing = false
let grabAngle: number | null = null
function handleAngle(p: { x: number; y: number }): number | null {
  const dx = p.x - HANDLE.x
  const dy = p.y - HANDLE.y
  return Math.hypot(dx, dy) < 6 ? null : Math.atan2(dy, dx)
}
function clampStrength(s: number) {
  return Math.min(1, Math.max(0, s))
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
  if (inside(p, BTN_CUSTOM)) {
    ui.custom = CUSTOMS[(CUSTOMS.indexOf(ui.custom) + 1) % CUSTOMS.length]
    game.custom = ui.custom
    audio.levelUp()
    save()
    return
  }
  if (inside(p, BTN_AUTO)) {
    ui.autoFire = !ui.autoFire
    if (!ui.autoFire) game.firing = false
    save()
    return
  }
  if (inside(p, BTN_MOTION)) {
    ui.reducedMotion = !ui.reducedMotion
    fx.reducedMotion = ui.reducedMotion
    save()
    return
  }
  if (game.pushPending) {
    // 押した瞬間から溜まり始め、離すと決着（タップならすぐ決着）
    game.pressDown()
    return
  }
  if (game.needsRefill && inside(p, BTN_REFILL)) {
    gate.press()
    return
  }
  // ハンドルをつかむと、回した角度で強さが変わる（つかんだ瞬間には変わらない）
  if (Math.hypot(p.x - HANDLE.x, p.y - HANDLE.y) <= HANDLE.r + 18) {
    grabbing = true
    grabAngle = handleAngle(p)
  }
  // 盤面のどこを押しても、いまの強さで発射する
  game.firing = true
})
canvas.addEventListener('pointermove', (ev) => {
  if (!ui.started || !grabbing) return
  const a = handleAngle(toLogical(ev))
  if (a === null) return
  if (grabAngle !== null) {
    let d = a - grabAngle
    if (d > Math.PI) d -= Math.PI * 2
    if (d < -Math.PI) d += Math.PI * 2
    game.strength = clampStrength(game.strength + d / HANDLE_SWEEP)
  }
  grabAngle = a
})
const release = () => {
  if (grabbing) save()
  grabbing = false
  grabAngle = null
  game.pressUp()
  // オート発射中は指を離しても撃ち続ける
  if (!ui.autoFire) game.firing = false
}
canvas.addEventListener('pointerup', release)
canvas.addEventListener('pointercancel', release)
window.addEventListener('blur', release)
window.addEventListener('keydown', (ev) => {
  // ↑→ で強く、↓← で弱く（押しっぱなしで連続して回る）
  const step = { ArrowUp: 0.02, ArrowRight: 0.02, ArrowDown: -0.02, ArrowLeft: -0.02 }[ev.code]
  if (step !== undefined) {
    ev.preventDefault()
    game.strength = clampStrength(game.strength + step)
    return
  }
  if (ev.code !== 'Space' || ev.repeat) return
  ev.preventDefault()
  audio.unlock()
  if (!ui.started) ui.started = true
  else if (game.pushPending) game.pressDown()
  else game.firing = true
})
window.addEventListener('keyup', (ev) => {
  if (ev.code.startsWith('Arrow')) save()
  if (ev.code === 'Space') game.pressUp()
  if (ev.code === 'Space' && !ui.autoFire) game.firing = false
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
  chara.update(dt)
  // SUPER 以上のリーチ中はポッチの舞台を出す（暗転・ブラックアウト中は出さない）
  const sp = game.spin
  chara.setReachScene(
    !!sp && !sp.done && (sp.stage === 'super' || sp.stage === 'premium') && !sp.dark && !sp.darken && !sp.blackout,
    dt,
  )
  gate.update(dt, game.needsRefill)
  ui.gate = gate.state
  if (gate.paused) {
    // 広告の再生中はゲームを止めて消音する
    game.firing = false
    audio.suspend()
  } else if (ui.started) {
    audio.resume()
    if (ui.autoFire && game.balls > 0) game.firing = true
    // 長押しの溜め：音が上がり、光の粒がボタンへ吸い込まれ、ポッチの炎が膨らむ
    if (game.charging) {
      chargeTick -= dt
      if (chargeTick <= 0) {
        audio.chargeTick(game.charge)
        chargeTick = 0.075
      }
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2
        const d = 120 + Math.random() * 60
        fx.particles.push({
          x: BUTTON.x + Math.cos(a) * d,
          y: BUTTON.y + Math.sin(a) * d,
          vx: -Math.cos(a) * d * 2.5,
          vy: -Math.sin(a) * d * 2.5,
          life: 0.4,
          max: 0.4,
          size: 2 + game.charge * 3,
          color: RAINBOW[Math.floor(Math.random() * RAINBOW.length)],
          kind: 'spark',
          rot: 0,
          vr: 0,
        })
      }
      fx.shake(0.02 + game.charge * 0.03)
      chara.breathe(game.charge > 0.7 ? 'rainbow' : 'rgb(255,120,60)', 0.3 + game.charge * 0.7, 0.2)
    }
    // 連チャンでポッチが育ったら光らせる
    const stage = charaStage()
    if (stage > lastStage) {
      chara.evolveFlash = 1
      chara.react('joy', 1)
      audio.pochiVoice('happy')
      audio.levelUp()
      fx.ring(CHARA_X, CHARA_Y, game.lt ? '#ffd23d' : '#5fd18a', 120)
    }
    lastStage = stage
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
  render(ctx, game, fx, ui, clock, chara, charaStage())
  ctx.restore()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// ---------------------------------------------------------------- 新しい版の自動反映

/** 遊んでいる途中（大当たり・RUSH・変動中）は読み込み直さない */
const safeToReload = () =>
  !ui.started || (game.phase === 'normal' && game.scene === 'play' && !game.spin && game.holds.length === 0)
let pendingUpdate = false
async function checkForUpdate() {
  if (pendingUpdate || (await isOutdated())) {
    pendingUpdate = true
    if (safeToReload()) reloadToLatest()
  }
}
void checkForUpdate()
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void checkForUpdate()
})
window.setInterval(() => void checkForUpdate(), 60_000)

