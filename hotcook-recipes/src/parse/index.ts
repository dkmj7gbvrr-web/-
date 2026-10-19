import type { RecipeDraft } from '../types'
import { cleanText, extractJsonLdRecipe } from './jsonld'
import { extractModes } from './mode'
import { extractFromText, visibleText } from './text'

function meta(doc: Document, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const el = doc.querySelector(`meta[property="${key}"], meta[name="${key}"]`)
    const v = el?.getAttribute('content')?.trim()
    if (v) return cleanText(v)
  }
  return undefined
}

function absolutize(src: string | undefined, base: string): string | undefined {
  if (!src) return undefined
  try {
    return new URL(src, base).toString()
  } catch {
    return undefined
  }
}

export function siteName(doc: Document | null, url: string): string | undefined {
  const fromMeta = doc ? meta(doc, 'og:site_name', 'application-name') : undefined
  if (fromMeta) return fromMeta
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

/** 「肉じゃが | ○○のブログ」のようなタイトルからサイト名部分を落とす */
function trimTitle(title: string, site?: string): string {
  let t = title
  if (site) t = t.replace(new RegExp(`\\s*[|｜\\-–—:：]\\s*${site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`), '')
  return t.replace(/\s*[|｜]\s*[^|｜]{2,40}$/, '').trim() || title
}

/** ページ中の「ホットクック」に触れている文だけを拾う（サイドバーの別レシピから拾わないため） */
function hotcookSentences(text: string): string[] {
  return text.split(/\n|。/).filter((s) => /ホットクック|手動|自動メニュー|メニュー番号|まぜ技/.test(s))
}

export function parseRecipeHtml(html: string, url: string): RecipeDraft {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const source = siteName(doc, url)
  const image = absolutize(meta(doc, 'og:image', 'twitter:image'), url)
  const pageTitle = meta(doc, 'og:title', 'twitter:title') ?? cleanText(doc.title ?? '')
  const ld = extractJsonLdRecipe(doc)
  const article = doc.querySelector('article, main, [itemprop="recipeInstructions"], .entry-content, .post-content') ?? doc.body
  const bodyText = article ? visibleText(article) : ''

  if (ld && (ld.ingredients.length > 0 || ld.steps.length > 0)) {
    let modes = extractModes([...ld.steps, ld.description ?? '', ...ld.ingredients])
    if (modes.length === 0) modes = extractModes(hotcookSentences(bodyText))
    return {
      title: ld.name ?? trimTitle(pageTitle, source),
      url,
      image: absolutize(ld.image, url) ?? image,
      servings: ld.servings,
      ingredients: ld.ingredients,
      steps: ld.steps,
      modes,
      source,
      method: 'jsonld',
    }
  }

  const fromText = extractFromText(bodyText)
  let modes = extractModes(fromText.steps)
  if (modes.length === 0) modes = extractModes(hotcookSentences(bodyText))
  // 記事の見出し（h1）はサイト名が付かないことが多いので、<title> より優先する
  const h1 = cleanText(article?.querySelector('h1')?.textContent ?? '')
  return {
    title: (h1.length > 0 && h1.length <= 80 ? h1 : '') || trimTitle(pageTitle || fromText.title || '', source),
    url,
    image,
    servings: fromText.servings,
    ingredients: fromText.ingredients,
    steps: fromText.steps,
    modes,
    source,
    method: 'heuristic',
  }
}

/** 貼り付けたテキスト（ページ全体のコピーや、メモ）から読み取る */
export function parseRecipeText(text: string, url = ''): RecipeDraft {
  const r = extractFromText(text)
  let modes = extractModes(r.steps)
  if (modes.length === 0) modes = extractModes(hotcookSentences(text))
  return {
    title: r.title ?? '',
    url,
    servings: r.servings,
    ingredients: r.ingredients,
    steps: r.steps,
    modes,
    source: url ? siteName(null, url) : undefined,
    method: 'heuristic',
  }
}
