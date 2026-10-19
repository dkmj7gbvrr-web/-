import type { HotcookMode, RecipeDraft } from '../types'
import { modeLabel } from './mode'

/**
 * AI チャット（無料版の Claude など）にスクショを読ませ、決まった形の JSON で返してもらい、
 * それをアプリに貼って取り込むための部品。サーバーも API キーも使わない。
 */

export type Capacity = '' | '1.0L' | '1.6L' | '2.4L'

/** AI チャットに貼る依頼文。capacity を指定すると、その容量の時間だけを書くよう頼む */
export function aiPrompt(capacity: Capacity): string {
  return [
    '添付したスクリーンショット（ホットクックのレシピ）を読み取って、下の形の JSON だけを ```json のコードブロックで出力してください。説明文は不要です。',
    '',
    '- 画像に書かれていないことは推測で埋めず、空のままにしてください。',
    '- 分量の数字は画像のとおりにしてください（「大3」→「大さじ3」のような書き換えは可）。',
    '- 材料のグループ見出しは「【ソース】」のように1行で ingredients に入れてください。',
    '- steps は1行に1手順。「↓」などの区切り記号は入れないでください。',
    '- modes はホットクックの設定です。自動メニューは kind を "auto" にして menuNo（番号）を、手動は kind を "manual" にして category（例: 煮物を作る）・stir（"まぜる" か "まぜない"）・minutes（分）を入れてください。',
    '  label は「自動メニュー No.42 さばのみそ煮 20分」「手動 › 煮物を作る（まぜる） 30分」の形にしてください。',
    capacity ? `- ホットクックの容量によって時間やメニューが違うと書かれている場合は、${capacity} の分だけを書き、他の容量の分は入れないでください。` : null,
    '- 複数枚の画像はつながった1つのレシピとして読み、重なっている部分は1回だけ書いてください。',
    '',
    '```json',
    JSON.stringify(
      {
        title: '料理名',
        servings: '',
        ingredients: ['【ソース】', '材料名 分量'],
        steps: ['手順'],
        modes: [{ kind: 'auto', menuNo: '', label: '' }],
        memo: '',
        source: '出典（サイト名や X のアカウント名）',
        url: '',
      },
      null,
      2,
    ),
    '```',
  ]
    .filter((l): l is string => l !== null)
    .join('\n')
}

type Json = Record<string, unknown>

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])

/** 返事の中から JSON を取り出す（```json のコードブロック、なければ最初の { から最後の } まで） */
function extractJson(text: string): Json | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidates = [fenced, text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)].filter(
    (c): c is string => !!c && c.trim().startsWith('{'),
  )
  for (const c of candidates) {
    try {
      const v = JSON.parse(c) as unknown
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Json
    } catch {
      // 次の候補へ
    }
  }
  return null
}

function toMode(v: unknown): HotcookMode | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Json
  const kind = o.kind === 'auto' || o.kind === 'manual' ? o.kind : 'other'
  const m: HotcookMode = { kind, label: '' }
  if (str(o.menuNo)) m.menuNo = str(o.menuNo)
  if (str(o.category)) m.category = str(o.category)
  if (o.stir === 'まぜる' || o.stir === 'まぜない') m.stir = o.stir
  const minutes = Number(o.minutes)
  if (o.minutes !== undefined && o.minutes !== '' && Number.isFinite(minutes)) m.minutes = minutes
  const celsius = Number(o.celsius)
  if (o.celsius !== undefined && o.celsius !== '' && Number.isFinite(celsius)) m.celsius = celsius
  // AI が書いた表示名を優先し、なければアプリの形で組み立てる
  m.label = str(o.label) || (kind === 'other' ? '' : modeLabel(m))
  if (!m.label) return null
  return m
}

/**
 * AI の返事を取り込み用の下書きにする。レシピの JSON として読めなければ null
 * （そのときは普通のテキストとして解析する）。
 */
export function parseAiRecipe(text: string, fallbackUrl = ''): RecipeDraft | null {
  const o = extractJson(text)
  if (!o) return null
  const ingredients = strList(o.ingredients)
  const steps = strList(o.steps)
  if (!str(o.title) && !ingredients.length && !steps.length) return null
  return {
    title: str(o.title),
    url: str(o.url) || fallbackUrl,
    servings: str(o.servings) || undefined,
    ingredients,
    steps,
    modes: (Array.isArray(o.modes) ? o.modes : []).map(toMode).filter((m): m is HotcookMode => m !== null),
    memo: str(o.memo) || undefined,
    source: str(o.source) || undefined,
    method: 'ai',
  }
}
