/**
 * 共有コードを知っている人同士で、レシピをリアルタイムに同期する（Firebase Firestore）。
 * 「ふたりの家計簿」（docs/index.html）と同じ Firebase プロジェクトを使い、保存場所だけ分けている。
 *   家計簿:   households/{世帯コード}/...
 *   レシピ帳: recipeBooks/{共有コード}/recipes/{レシピID}
 * ログインは無く、共有コードを知っている人なら誰でも読み書きできる（docs/firestore.rules 参照）。
 * Firebase の SDK は大きいので、共有を使うときだけ読み込む（App から動的 import する）。
 */
import { initializeApp } from 'firebase/app'
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  increment,
  limit,
  query,
  initializeFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import type { Recipe } from './types'
import { normalizeRecipe } from './storage'

const firebaseConfig = {
  apiKey: 'AIzaSyAmYJ8BCP9ppzc9H7I0sUN6Yz1NKNmZP5Q',
  authDomain: 'lifev2-6bf0b.firebaseapp.com',
  projectId: 'lifev2-6bf0b',
  storageBucket: 'lifev2-6bf0b.firebasestorage.app',
  messagingSenderId: '805090296615',
  appId: '1:805090296615:web:13d124f1d3e2b554fb1f02',
}

let db: Firestore | null = null

function getDb(): Firestore {
  if (db) return db
  const app = initializeApp(firebaseConfig, 'hotcook-recipes')
  db = initializeFirestore(app, { ignoreUndefinedProperties: true })
  // テスト用: ビルド時に VITE_FIRESTORE_EMULATOR=127.0.0.1:8080 を渡すとエミュレーターにつなぐ
  const emu = import.meta.env.VITE_FIRESTORE_EMULATOR as string | undefined
  if (emu) {
    const [host, port] = emu.split(':')
    connectFirestoreEmulator(db, host, Number(port))
  }
  return db
}

const recipesCol = (code: string) => collection(getDb(), 'recipeBooks', code, 'recipes')
const recipeDoc = (code: string, id: string) => doc(getDb(), 'recipeBooks', code, 'recipes', id)

export type SyncErrorKind = 'permission' | 'network' | 'other'

export function classifyError(e: unknown): SyncErrorKind {
  const code = (e as { code?: string })?.code ?? ''
  if (code === 'permission-denied') return 'permission'
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'network'
  return 'other'
}

/** 共有レシピ帳を読めるか確かめる（ルール未更新などで読めなければ例外を投げる） */
export async function checkAccess(code: string): Promise<void> {
  await getDocs(query(recipesCol(code), limit(1)))
}

/** 共有レシピ帳の中身を購読する。返り値を呼ぶと購読をやめる */
export function subscribeRecipes(code: string, onData: (recipes: Recipe[], fromCache: boolean) => void, onError: (e: unknown) => void): () => void {
  return onSnapshot(
    recipesCol(code),
    // 「端末内の控え→サーバーの最新」に切り替わったことも受け取り、オフライン表示を消すため
    { includeMetadataChanges: true },
    (snap) => {
      const recipes = snap.docs.map((d) => normalizeRecipe({ ...d.data(), id: d.id })).filter((r): r is Recipe => r !== null)
      onData(recipes, snap.metadata.fromCache)
    },
    onError,
  )
}

export async function putRecipe(code: string, r: Recipe): Promise<void> {
  await setDoc(recipeDoc(code, r.id), r)
}

/** 一部の項目だけ書き換える（undefined の項目は Firestore 上から消す） */
export async function patchRecipe(code: string, id: string, patch: Partial<Recipe>): Promise<void> {
  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) data[k] = v === undefined ? deleteField() : v
  await updateDoc(recipeDoc(code, id), data)
}

/** 「作った！」は複数人が同時に押しても数がずれないよう、加算で書き込む */
export async function bumpCooked(code: string, id: string, delta: number, lastCookedAt?: string): Promise<void> {
  const data: Record<string, unknown> = { cookedCount: increment(delta), updatedAt: new Date().toISOString() }
  if (lastCookedAt) data.lastCookedAt = lastCookedAt
  await updateDoc(recipeDoc(code, id), data)
}

export async function removeRecipe(code: string, id: string): Promise<void> {
  await deleteDoc(recipeDoc(code, id))
}

/** まとめて書き込む（共有を始めたときに手元のレシピを入れる・JSON の読み込み） */
export async function putRecipes(code: string, recipes: Recipe[]): Promise<void> {
  // 1回のバッチで書ける件数に上限（500）があるので分割する
  for (let i = 0; i < recipes.length; i += 400) {
    const batch = writeBatch(getDb())
    for (const r of recipes.slice(i, i + 400)) batch.set(recipeDoc(code, r.id), r)
    await batch.commit()
  }
}
