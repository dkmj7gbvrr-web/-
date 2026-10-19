import type { Recipe } from './types'
import type { Capacity } from './parse/aiRecipe'

/**
 * データはこの端末のブラウザ（localStorage）に保存する。
 * 共有コードを設定しているときは Firestore（sync.ts）が正で、ここには最後に受け取った内容を
 * 控えとして置く（次に開いたとき、通信を待たずに一覧を出すため）。
 * 共有していないときはサーバーに何も送らない。機種変更などは「書き出し」「読み込み」で JSON を受け渡す。
 */

const KEY = 'hotcook-recipes:v1'

export interface Settings {
  /** 自分の CORS プロキシ（空なら公開プロキシのみ） */
  proxyUrl: string
  /** 共有コード（空ならこの端末だけで使う） */
  shareCode: string
  /** お使いのホットクックの容量（AI への依頼文で、この容量の時間だけを書いてもらう。空なら指定しない） */
  capacity: Capacity
}

export interface StoreData {
  recipes: Recipe[]
  settings: Settings
}

const EMPTY: StoreData = { recipes: [], settings: { proxyUrl: '', shareCode: '', capacity: '' } }

export function load(): StoreData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const data = JSON.parse(raw) as Partial<StoreData>
    return {
      recipes: Array.isArray(data.recipes) ? data.recipes.map(normalizeRecipe).filter((r): r is Recipe => r !== null) : [],
      settings: { ...EMPTY.settings, ...data.settings },
    }
  } catch {
    return EMPTY
  }
}

export function save(data: StoreData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

/** ブラウザに「勝手に消さないで」と頼む（対応ブラウザのみ。断られても動作は変わらない） */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    // 非対応
  }
}

/** 読み込んだ JSON の1件を、足りない項目を補って Recipe にする（壊れた行は捨てる） */
export function normalizeRecipe(v: unknown): Recipe | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Partial<Recipe>
  if (typeof r.id !== 'string' || typeof r.title !== 'string') return null
  const now = new Date().toISOString()
  const strs = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])
  return {
    id: r.id,
    url: typeof r.url === 'string' ? r.url : '',
    title: r.title,
    image: typeof r.image === 'string' ? r.image : undefined,
    servings: typeof r.servings === 'string' ? r.servings : undefined,
    ingredients: strs(r.ingredients),
    steps: strs(r.steps),
    modes: Array.isArray(r.modes) ? r.modes.filter((m) => m && typeof m.label === 'string') : [],
    tags: strs(r.tags),
    memo: typeof r.memo === 'string' ? r.memo : '',
    rating: typeof r.rating === 'number' ? Math.max(0, Math.min(5, Math.round(r.rating))) : 0,
    cookedCount: typeof r.cookedCount === 'number' ? Math.max(0, Math.floor(r.cookedCount)) : 0,
    lastCookedAt: typeof r.lastCookedAt === 'string' ? r.lastCookedAt : undefined,
    source: typeof r.source === 'string' ? r.source : undefined,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  }
}

export function exportJson(data: StoreData): string {
  return JSON.stringify({ app: 'hotcook-recipes', version: 1, exportedAt: new Date().toISOString(), recipes: data.recipes }, null, 2)
}

/**
 * 書き出した JSON を取り込む。同じ id は更新日時が新しい方を残し、新しいものは足す。
 * 返り値は 取り込み後の一覧・追加/更新したレシピ・それぞれの件数
 */
export function mergeImported(current: Recipe[], json: string): { recipes: Recipe[]; changed: Recipe[]; added: number; updated: number } {
  const parsed = JSON.parse(json) as { recipes?: unknown } | unknown[]
  const incoming = (Array.isArray(parsed) ? parsed : ((parsed as { recipes?: unknown }).recipes ?? []))
  if (!Array.isArray(incoming)) throw new Error('レシピの一覧が見つかりません')
  const byId = new Map(current.map((r) => [r.id, r]))
  const changed: Recipe[] = []
  let added = 0
  let updated = 0
  for (const raw of incoming) {
    const r = normalizeRecipe(raw)
    if (!r) continue
    const existing = byId.get(r.id)
    if (!existing) {
      byId.set(r.id, r)
      changed.push(r)
      added++
    } else if (r.updatedAt > existing.updatedAt) {
      byId.set(r.id, r)
      changed.push(r)
      updated++
    }
  }
  return { recipes: Array.from(byId.values()), changed, added, updated }
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
