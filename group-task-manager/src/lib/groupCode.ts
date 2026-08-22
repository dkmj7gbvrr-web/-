import { prisma } from "@/lib/prisma";

// 紛らわしい文字 (0/O, 1/I) を除いた英数字でグループ参加コードを生成する。
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export async function generateUniqueGroupCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await prisma.group.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("グループコードの生成に失敗しました。もう一度お試しください。");
}
