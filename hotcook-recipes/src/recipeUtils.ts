import type { Recipe, RecipeDraft } from './types'
import { modeGroup } from './parse/mode'
import { newId } from './storage'

export function draftToRecipe(d: RecipeDraft, extra?: Partial<Recipe>): Recipe {
  const now = new Date().toISOString()
  return {
    id: newId(),
    url: d.url,
    title: d.title.trim() || '名前のないレシピ',
    image: d.image,
    servings: d.servings,
    ingredients: d.ingredients,
    steps: d.steps,
    modes: d.modes,
    tags: [],
    memo: '',
    rating: 0,
    cookedCount: 0,
    source: d.source,
    createdAt: now,
    updatedAt: now,
    ...extra,
  }
}

export function emptyDraft(url = ''): RecipeDraft {
  return { title: '', url, ingredients: [], steps: [], modes: [], method: 'manual' }
}

/** URL の比較用（末尾スラッシュ・#以降・utm 系パラメータの違いは同じとみなす） */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim())
    u.hash = ''
    for (const k of Array.from(u.searchParams.keys())) if (/^utm_|^fbclid$|^gclid$/.test(k)) u.searchParams.delete(k)
    return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`
  } catch {
    return url.trim()
  }
}

/** 共有テキスト（「肉じゃが https://...」など）から最初の URL を取り出す */
export function findUrl(text: string): string | undefined {
  return text.match(/https?:\/\/[^\s"'<>（）「」]+/)?.[0]
}

export function recipeGroups(r: Recipe): string[] {
  return r.modes.length ? Array.from(new Set(r.modes.map(modeGroup))) : ['モード未設定']
}

export function matchesQuery(r: Recipe, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = [r.title, r.source ?? '', r.memo, ...r.tags, ...r.ingredients, ...r.modes.map((m) => m.label)].join('\n').toLowerCase()
  return words.every((w) => hay.includes(w))
}

export type SortKey = 'new' | 'name' | 'cooked' | 'recent' | 'rating'

export function sortRecipes(list: Recipe[], key: SortKey): Recipe[] {
  const arr = [...list]
  switch (key) {
    case 'name':
      return arr.sort((a, b) => a.title.localeCompare(b.title, 'ja'))
    case 'cooked':
      return arr.sort((a, b) => b.cookedCount - a.cookedCount || b.createdAt.localeCompare(a.createdAt))
    case 'recent':
      return arr.sort((a, b) => (b.lastCookedAt ?? '').localeCompare(a.lastCookedAt ?? '') || b.createdAt.localeCompare(a.createdAt))
    case 'rating':
      return arr.sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt))
    default:
      return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

export function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}
