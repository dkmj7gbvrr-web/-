/**
 * タスク名の正規化と類似度判定。
 * 全角/半角スペース・記号を除去し小文字化した上でLevenshtein距離ベースの
 * 類似度スコア(0〜1)を計算し、しきい値以上なら「同じタスク」とみなす。
 */

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[、。・！？!?,.:：;；「」『』【】()（）\-_/／]/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

const SIMILARITY_THRESHOLD = 0.75;

export function isSameTask(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if ((na.includes(nb) || nb.includes(na)) && Math.min(na.length, nb.length) >= 2) {
    return true;
  }
  return titleSimilarity(a, b) >= SIMILARITY_THRESHOLD;
}
