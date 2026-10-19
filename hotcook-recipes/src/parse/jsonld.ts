/**
 * schema.org の Recipe（<script type="application/ld+json">）を読む。
 * レシピサイトやレシピ用 WordPress プラグインの多くが、検索エンジン向けにこの形式で
 * 料理名・材料・手順を埋め込んでいるので、あればこれが一番正確。
 */

export interface JsonLdRecipe {
  name?: string
  image?: string
  servings?: string
  description?: string
  ingredients: string[]
  steps: string[]
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

/** 文字列中のタグと HTML 実体参照（&amp; など）を取り除く */
export function cleanText(s: string): string {
  const withoutTags = s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${withoutTags.replace(/</g, '&lt;')}`, 'text/html')
  return (doc.body.textContent ?? '').replace(/[ \t 　]+/g, ' ').trim()
}

function isObj(v: Json | undefined): v is { [k: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function hasType(o: { [k: string]: Json }, type: string): boolean {
  const t = o['@type']
  if (typeof t === 'string') return t === type || t.endsWith(`/${type}`)
  if (Array.isArray(t)) return t.some((x) => typeof x === 'string' && (x === type || x.endsWith(`/${type}`)))
  return false
}

/** @graph や配列の入れ子をたどって Recipe を探す */
function findRecipe(v: Json | undefined, depth = 0): { [k: string]: Json } | null {
  if (depth > 6 || v === undefined || v === null) return null
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = findRecipe(x, depth + 1)
      if (r) return r
    }
    return null
  }
  if (!isObj(v)) return null
  if (hasType(v, 'Recipe')) return v
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement']) {
    const r = findRecipe(v[key], depth + 1)
    if (r) return r
  }
  return null
}

function asString(v: Json | undefined): string | undefined {
  if (typeof v === 'string') return cleanText(v) || undefined
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) {
    // recipeYield は ["4", "4人分"] のように同じ意味の値が並ぶことがあるので、長い方（説明的な方）を採る
    const strs = v.map(asString).filter((x): x is string => !!x)
    return strs.sort((a, b) => b.length - a.length)[0]
  }
  return undefined
}

function asImage(v: Json | undefined): string | undefined {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return asImage(v[0])
  if (isObj(v)) return asImage(v.url ?? v.contentUrl)
  return undefined
}

/** recipeInstructions は 文字列 / 文字列の配列 / HowToStep / HowToSection が混ざりうる */
function flattenSteps(v: Json | undefined, out: string[], depth = 0): void {
  if (depth > 5 || v === undefined || v === null) return
  if (typeof v === 'string') {
    const text = cleanText(v)
    // 1つの文字列に全手順が改行区切りで入っているサイトもある
    for (const line of text.split(/\n+/)) if (line.trim()) out.push(line.trim())
    return
  }
  if (Array.isArray(v)) {
    for (const x of v) flattenSteps(x, out, depth + 1)
    return
  }
  if (!isObj(v)) return
  if (hasType(v, 'HowToSection')) {
    const name = asString(v.name)
    if (name) out.push(`【${name}】`)
    flattenSteps(v.itemListElement, out, depth + 1)
    return
  }
  const text = asString(v.text) ?? asString(v.name) ?? asString(v.description)
  if (text) out.push(text)
  else if (v.itemListElement) flattenSteps(v.itemListElement, out, depth + 1)
}

function parseJson(raw: string): Json | undefined {
  try {
    return JSON.parse(raw) as Json
  } catch {
    // 末尾カンマや制御文字で壊れている埋め込みがたまにあるので、軽く直してもう一度
    try {
      // eslint-disable-next-line no-control-regex
      return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001f]+/g, ' ')) as Json
    } catch {
      return undefined
    }
  }
}

export function extractJsonLdRecipe(doc: Document): JsonLdRecipe | null {
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    const recipe = findRecipe(parseJson(script.textContent ?? ''))
    if (!recipe) continue
    const ingredientsRaw = recipe.recipeIngredient ?? recipe.ingredients
    const ingredients = (Array.isArray(ingredientsRaw) ? ingredientsRaw : [ingredientsRaw])
      .map(asString)
      .filter((x): x is string => !!x)
    const steps: string[] = []
    flattenSteps(recipe.recipeInstructions, steps)
    return {
      name: asString(recipe.name),
      image: asImage(recipe.image),
      servings: asString(recipe.recipeYield),
      description: asString(recipe.description),
      ingredients,
      steps,
    }
  }
  return null
}
