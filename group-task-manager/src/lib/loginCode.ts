import { prisma } from "@/lib/prisma";

// グループコードと同じ、紛らわしい文字(0/O, 1/I)を除いた英数字。
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSegment(length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

/** 表示用: "ABCD-EFGH12" のような読みやすい形式。 */
function formatLoginCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}${raw.slice(8, 10)}`;
}

/** 入力欄に貼り付けられたコードから、区切り記号や空白を取り除く。 */
export function normalizeLoginCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function generateUniqueLoginCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = formatLoginCode(randomSegment(10));
    const existing = await prisma.user.findUnique({ where: { loginCode: code } });
    if (!existing) return code;
  }
  throw new Error("ログインコードの生成に失敗しました。もう一度お試しください。");
}
