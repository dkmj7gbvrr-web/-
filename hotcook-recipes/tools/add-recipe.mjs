#!/usr/bin/env node
/**
 * 共有レシピ帳（Firestore の recipeBooks/{共有コード}/recipes）に、レシピを1件書き込む。
 * Claude Code のチャットに貼られたスクショなどを Claude が読み取って JSON にし、このスクリプトで登録する想定。
 * 手順は .claude/skills/hotcook-add-recipe/SKILL.md を参照。
 *
 *   node hotcook-recipes/tools/add-recipe.mjs <共有コード> <recipe.json> [--dry-run] [--force]
 *
 * recipe.json の形（アプリの Recipe 型のうち、入力するもの）:
 *   { "title": "...", "url": "", "image": "", "servings": "2人分",
 *     "ingredients": ["【A】", "玉ねぎ 1個"], "steps": ["..."],
 *     "modes": [{ "kind": "auto" | "manual" | "other", "label": "...", "menuNo": "42", "category": "煮物を作る",
 *                 "stir": "まぜる" | "まぜない", "minutes": 20, "celsius": 60 }],
 *     "tags": ["..."], "memo": "...", "source": "サイト名など" }
 *
 * --dry-run: 書き込まずに、登録する内容と重複チェックの結果だけ表示する
 * --force:   同じ料理（同じURL、またはURLなしで同じ料理名・出典）が登録済みでも書き込む
 */
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { collection, doc, getDoc, getDocs, initializeFirestore, setDoc, terminate } from 'firebase/firestore'

// アプリ（src/sync.ts）と同じ Firebase プロジェクト
const firebaseConfig = {
  apiKey: 'AIzaSyAmYJ8BCP9ppzc9H7I0sUN6Yz1NKNmZP5Q',
  authDomain: 'lifev2-6bf0b.firebaseapp.com',
  projectId: 'lifev2-6bf0b',
  storageBucket: 'lifev2-6bf0b.firebasestorage.app',
  messagingSenderId: '805090296615',
  appId: '1:805090296615:web:13d124f1d3e2b554fb1f02',
}

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const [code, file] = args.filter((a) => !a.startsWith('--'))

function fail(msg) {
  console.error(`エラー: ${msg}`)
  process.exit(1)
}

if (!code || !file) fail('使い方: node hotcook-recipes/tools/add-recipe.mjs <共有コード> <recipe.json> [--dry-run] [--force]')
// docs/firestore.rules と src/shareCode.ts の条件に合わせる
if (!/^[a-z0-9]{10,64}$/.test(code)) fail('共有コードは英小文字と数字の10〜64文字です')

const input = JSON.parse(readFileSync(file, 'utf8'))
const strs = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : [])
if (typeof input.title !== 'string' || !input.title.trim()) fail('title（料理名）がありません')

const modes = (Array.isArray(input.modes) ? input.modes : []).map((m) => {
  if (!m || typeof m.label !== 'string' || !m.label.trim()) fail('modes の各要素には label が必要です')
  if (!['auto', 'manual', 'other'].includes(m.kind)) fail(`modes.kind は auto / manual / other のどれかです: ${m.kind}`)
  const out = { kind: m.kind, label: m.label.trim() }
  for (const k of ['category', 'stir', 'menuNo', 'snippet']) if (typeof m[k] === 'string' && m[k]) out[k] = m[k]
  for (const k of ['minutes', 'celsius']) if (typeof m[k] === 'number') out[k] = m[k]
  return out
})

const now = new Date().toISOString()
const recipe = {
  // アプリの newId()（src/storage.ts）と同じ形
  id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  url: typeof input.url === 'string' ? input.url.trim() : '',
  title: input.title.trim(),
  image: typeof input.image === 'string' && input.image.trim() ? input.image.trim() : undefined,
  servings: typeof input.servings === 'string' && input.servings.trim() ? input.servings.trim() : undefined,
  ingredients: strs(input.ingredients),
  steps: strs(input.steps),
  modes,
  tags: strs(input.tags),
  memo: typeof input.memo === 'string' ? input.memo.trim() : '',
  rating: 0,
  cookedCount: 0,
  source: typeof input.source === 'string' && input.source.trim() ? input.source.trim() : undefined,
  createdAt: now,
  updatedAt: now,
}

// src/recipeUtils.ts の normalizeUrl と同じ考え方（# 以降・utm 系・末尾の / を無視）
function normalizeUrl(url) {
  try {
    const u = new URL(url.trim())
    u.hash = ''
    for (const k of Array.from(u.searchParams.keys())) if (/^utm_|^fbclid$|^gclid$/.test(k)) u.searchParams.delete(k)
    return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`
  } catch {
    return url.trim()
  }
}

const app = initializeApp(firebaseConfig, 'hotcook-add-recipe')
const db = initializeFirestore(app, { ignoreUndefinedProperties: true })
const col = collection(db, 'recipeBooks', code, 'recipes')

try {
  const existing = (await getDocs(col)).docs.map((d) => ({ id: d.id, ...d.data() }))
  const dup = existing.find((r) =>
    recipe.url
      ? r.url && normalizeUrl(r.url) === normalizeUrl(recipe.url)
      : !r.url && r.title === recipe.title && (r.source ?? '') === (recipe.source ?? ''),
  )
  console.log(`共有レシピ帳の登録件数: ${existing.length}件`)
  if (dup) {
    console.log(`同じレシピが登録済みです: 「${dup.title}」（id: ${dup.id}）`)
    if (!flags.has('--force')) {
      console.log('書き込みませんでした（上書きせず追加したい場合は --force）')
      process.exit(2)
    }
  }
  if (flags.has('--dry-run')) {
    console.log('--dry-run のため書き込みませんでした。登録予定の内容:')
    console.log(JSON.stringify(recipe, null, 2))
  } else {
    await setDoc(doc(col, recipe.id), recipe)
    // 書き込めたことを読み直して確かめる
    const back = await getDoc(doc(col, recipe.id))
    if (!back.exists()) fail('書き込んだはずのレシピが読み戻せませんでした')
    const saved = back.data()
    console.log(`登録しました: 「${saved.title}」（id: ${recipe.id}）`)
    console.log(`材料 ${saved.ingredients.length}行 / 工程 ${saved.steps.length}行 / モード: ${saved.modes.map((m) => m.label).join('、') || 'なし'}`)
  }
} catch (e) {
  fail(e?.code === 'permission-denied' ? '共有レシピ帳に書き込めませんでした（Firebase のルールを確認してください）' : String(e?.message ?? e))
} finally {
  await terminate(db)
}
