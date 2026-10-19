/**
 * 「Claude で登録」ボタン（マスタのレシピ帳だけに出す）。
 * スクショの読み取りと登録は、このリポジトリの Claude Code のチャットで Claude が行う
 * （手順は .claude/skills/hotcook-add-recipe/SKILL.md）。アプリは依頼文をコピーしてチャットを開くだけ。
 */

/**
 * マスタの共有コードの SHA-256。公開されるアプリのコードに共有コードそのものを書かないよう、ハッシュで照合する。
 * 共有コードを変えたら、`printf '%s' <新しいコード> | sha256sum` の値に差し替える。
 */
const MASTER_CODE_SHA256 = '1cf564fc5713da8e76796055be8907c915b0efff755629b95e434ad3de7b9d59'

/** 依頼先のチャット（このアプリを作った Claude Code のセッション）。会話履歴ごと開き直せる */
export const CLAUDE_SESSION_URL = 'https://claude.ai/code/session_016oA5Gju9x5UpdHSDuWM4jM'
/** 上のチャットが使えなくなったとき用（新しいチャットを始める画面。リポジトリは自分で選ぶ） */
export const CLAUDE_NEW_SESSION_URL = 'https://claude.ai/code'

export async function isMasterCode(code: string): Promise<boolean> {
  if (!code || !crypto?.subtle) return false
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return hex === MASTER_CODE_SHA256
}

/** チャットに貼る依頼文 */
export function claudePrompt(code: string, url?: string): string {
  return [
    `共有コード ${code} のレシピ帳に、このあと貼るスクショのレシピを登録して。`,
    url ? `元のレシピ: ${url}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
