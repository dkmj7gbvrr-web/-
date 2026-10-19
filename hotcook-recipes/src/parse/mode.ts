import type { HotcookMode } from '../types'

/**
 * レシピ本文から、ホットクックで使うモード（自動メニュー番号 / 手動の設定）を拾う。
 * 野良レシピは書き方がばらばらなので、決め打ちの完全一致ではなく
 * 「ホットクックらしい言葉が同じ文に出てくるか」で拾い、根拠の原文（snippet）も残す。
 * 拾い漏れ・拾い過ぎはあり得るので、保存前に画面で直せる前提。
 */

/** 手動調理のカテゴリーとして拾う言葉（長いものから順に照合する） */
const MANUAL_CATEGORIES = [
  'めん類をゆでる',
  '煮物を作る',
  'スープを作る',
  '発酵・低温調理',
  'ケーキを焼く',
  '低温調理',
  '煮詰める',
  '炒める',
  '発酵',
  '蒸す',
  'ゆでる',
  '茹でる',
  '炊飯',
  '煮物',
  'スープ',
] as const

/** 「煮物2-1」「スープ1-3」のような、機種ごとの自動メニュー番号 */
const CODED_MENU = /(煮物|炒め物?|スープ|蒸し物?|ゆで物?|めん類?|発酵|低温調理|煮詰め|お菓子|ご飯|炊飯)\s*(\d{1,2}\s*[-－ー‐]\s*\d{1,2})/

/** 「メニュー番号123」「自動メニュー No.45」「メニューNo.12」 */
const MENU_NO = /(?:メニュー\s*(?:番号)?|自動\s*(?:メニュー)?)\s*[:：]?\s*(?:No\.?|NO\.?|№|ナンバー)?\s*[:：]?\s*(\d{1,3})(?!\s*[分℃度時gｇ個本枚人])/
/** 単独の「No.123」（ホットクックらしい言葉が同じ文にあるときだけ採用する） */
const BARE_NO = /(?:No\.?|NO\.?|№)\s*(\d{1,3})(?!\s*[分℃度時gｇ個本枚人])/

const HOTCOOK_CONTEXT = /ホットクック|HOTCOOK|hotcook|自動|手動|メニュー|まぜ技|スタート|加熱/
const MANUAL_WORD = /手動/
const STIR_OFF = /まぜない|混ぜない|まぜ技なし|まぜ技:?なし/
const STIR_ON = /まぜる|混ぜる|まぜ技あり|まぜ技/

function toHalfWidth(s: string): string {
  return s.replace(/[０-９Ａ-Ｚａ-ｚ．：－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
}

/** 「1時間30分」「40分」→ 分。見つからなければ undefined */
function findMinutes(s: string): number | undefined {
  const hm = s.match(/(\d{1,2})\s*時間\s*(?:(\d{1,2})\s*分)?/)
  if (hm) return Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0)
  const m = s.match(/(\d{1,3})\s*分/)
  return m ? Number(m[1]) : undefined
}

function findCelsius(s: string): number | undefined {
  const m = s.match(/(\d{2})\s*(?:℃|°C|度)/)
  return m ? Number(m[1]) : undefined
}

function findCategory(s: string): string | undefined {
  for (const c of MANUAL_CATEGORIES) if (s.includes(c)) return c === '茹でる' ? 'ゆでる' : c
  return undefined
}

/** 文に分ける。改行・句点・「→」区切りの手順もある程度まとまるよう、句点と改行だけで切る */
function sentences(texts: string[]): string[] {
  return texts
    .flatMap((t) => toHalfWidth(t).split(/[\n。！!？?]+/))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0)
}

function snippetOf(s: string): string {
  return s.length > 90 ? `${s.slice(0, 88)}…` : s
}

export function modeLabel(m: HotcookMode): string {
  if (m.kind === 'auto') {
    const no = m.menuNo ? (/^\d+$/.test(m.menuNo) ? `No.${m.menuNo}` : m.menuNo) : ''
    return ['自動メニュー', no].filter(Boolean).join(' ')
  }
  if (m.kind === 'manual') {
    const parts = ['手動']
    if (m.category) parts.push(m.stir ? `${m.category}（${m.stir}）` : m.category)
    else if (m.stir) parts.push(m.stir)
    const tail = [m.celsius !== undefined ? `${m.celsius}℃` : '', m.minutes !== undefined ? `${m.minutes}分` : '']
      .filter(Boolean)
      .join(' ')
    return tail ? `${parts.join(' › ')} ${tail}` : parts.join(' › ')
  }
  return m.label
}

function analyzeSentence(s: string): HotcookMode | null {
  const coded = s.match(CODED_MENU)
  if (coded) {
    const menuNo = `${coded[1]}${coded[2].replace(/\s/g, '').replace(/[－ー‐]/g, '-')}`
    const m: HotcookMode = { kind: 'auto', label: '', menuNo, snippet: snippetOf(s) }
    m.label = modeLabel(m)
    return m
  }

  const menu = s.match(MENU_NO) ?? (HOTCOOK_CONTEXT.test(s) ? s.match(BARE_NO) : null)
  if (menu) {
    const m: HotcookMode = { kind: 'auto', label: '', menuNo: menu[1], snippet: snippetOf(s) }
    m.label = modeLabel(m)
    return m
  }

  const manual = MANUAL_WORD.test(s)
  const category = findCategory(s)
  // カテゴリー名は普通の手順にも出てくる（「玉ねぎを炒める」）ので、
  // 「手動」か、まぜる/まぜない＋時間の組み合わせがあるときだけホットクックの設定とみなす
  const stir = STIR_OFF.test(s) ? 'まぜない' : STIR_ON.test(s) ? 'まぜる' : undefined
  const minutes = findMinutes(s)
  const looksLikeSetting = manual || (category !== undefined && stir !== undefined && minutes !== undefined && HOTCOOK_CONTEXT.test(s))
  if (!looksLikeSetting) return null
  if (!manual && !category) return null

  const m: HotcookMode = { kind: 'manual', label: '', snippet: snippetOf(s) }
  if (category) m.category = category
  if (stir && (manual || category)) m.stir = stir
  if (minutes !== undefined) m.minutes = minutes
  const celsius = findCelsius(s)
  if (celsius !== undefined && (category?.includes('発酵') || category?.includes('低温') || celsius < 100)) m.celsius = celsius
  // 「手動」とだけあって中身の手がかりが何もない文（「手動でもOK」など）は捨てる
  if (!m.category && !m.stir && m.minutes === undefined) return null
  m.label = modeLabel(m)
  return m
}

export function extractModes(texts: string[]): HotcookMode[] {
  const found: HotcookMode[] = []
  const seen = new Set<string>()
  for (const s of sentences(texts)) {
    const m = analyzeSentence(s)
    if (!m || seen.has(m.label)) continue
    seen.add(m.label)
    found.push(m)
  }
  return found
}

/** 一覧のフィルタに使う大分類 */
export function modeGroup(m: HotcookMode): string {
  if (m.kind === 'auto') return '自動メニュー'
  if (m.kind === 'manual') return m.category ? `手動・${m.category.replace(/を作る$/, '')}` : '手動'
  return 'その他'
}
