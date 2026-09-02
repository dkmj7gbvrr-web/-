// 初回デプロイ時、Itemが1件も無い場合にだけ「あるある」な消耗品を投入する。
// すでに品目が登録されている場合(ユーザーが使い始めた後)は何もしない。
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DEFAULT_ITEMS: { name: string; category: string }[] = [
  { name: "食器用洗剤", category: "洗剤" },
  { name: "洗濯洗剤", category: "洗剤" },
  { name: "柔軟剤", category: "洗剤" },
  { name: "トイレットペーパー", category: "紙類" },
  { name: "ティッシュペーパー", category: "紙類" },
  { name: "醤油", category: "調味料" },
  { name: "味噌", category: "調味料" },
  { name: "塩", category: "調味料" },
  { name: "砂糖", category: "調味料" },
  { name: "サラダ油", category: "調味料" },
  { name: "シャンプー", category: "日用品" },
  { name: "ボディソープ", category: "日用品" },
  { name: "歯みがき粉", category: "日用品" },
  { name: "ゴミ袋", category: "日用品" },
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const count = await prisma.item.count();
  if (count > 0) {
    console.log(`Item already has ${count} row(s); skipping default seed.`);
    await prisma.$disconnect();
    return;
  }

  await prisma.item.createMany({
    data: DEFAULT_ITEMS.map((item) => ({ ...item, status: "NORMAL" as const })),
  });
  console.log(`Seeded ${DEFAULT_ITEMS.length} default items.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
