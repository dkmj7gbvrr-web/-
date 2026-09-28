// 「あるある」な消耗品を、まだ無いものだけ個別に追加する。
// (全体が空でなくても、DEFAULT_ITEMSを後から増やせばその分だけ追加される。
//  ユーザーが既に同名の品目を登録・削除している場合はそれを尊重し、
//  上書き・重複作成はしない)
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DEFAULT_ITEMS: { name: string; category: string }[] = [
  // 洗剤
  { name: "食器用洗剤", category: "洗剤" },
  { name: "食洗機用洗剤", category: "洗剤" },
  { name: "洗濯洗剤", category: "洗剤" },
  { name: "柔軟剤", category: "洗剤" },
  { name: "漂白剤", category: "洗剤" },
  { name: "お風呂用洗剤", category: "洗剤" },
  { name: "トイレ用洗剤", category: "洗剤" },
  { name: "キッチン用除菌スプレー", category: "洗剤" },
  // 紙類
  { name: "トイレットペーパー", category: "紙類" },
  { name: "ティッシュペーパー", category: "紙類" },
  { name: "キッチンペーパー", category: "紙類" },
  { name: "ラップ", category: "紙類" },
  { name: "アルミホイル", category: "紙類" },
  { name: "ジップロック", category: "紙類" },
  // 調味料
  { name: "醤油", category: "調味料" },
  { name: "味噌", category: "調味料" },
  { name: "塩", category: "調味料" },
  { name: "砂糖", category: "調味料" },
  { name: "サラダ油", category: "調味料" },
  { name: "酢", category: "調味料" },
  { name: "みりん", category: "調味料" },
  { name: "料理酒", category: "調味料" },
  { name: "マヨネーズ", category: "調味料" },
  { name: "ケチャップ", category: "調味料" },
  // 日用品
  { name: "シャンプー", category: "日用品" },
  { name: "コンディショナー", category: "日用品" },
  { name: "ボディソープ", category: "日用品" },
  { name: "ハンドソープ", category: "日用品" },
  { name: "歯みがき粉", category: "日用品" },
  { name: "歯ブラシ", category: "日用品" },
  { name: "洗顔料", category: "日用品" },
  { name: "ゴミ袋", category: "日用品" },
  { name: "綿棒", category: "日用品" },
  { name: "電池", category: "日用品" },
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  let created = 0;
  for (const item of DEFAULT_ITEMS) {
    const exists = await prisma.item.findFirst({ where: { name: item.name } });
    if (exists) continue;
    await prisma.item.create({ data: { ...item, status: "NORMAL" } });
    created += 1;
  }

  console.log(`Seeded ${created} new default item(s) (${DEFAULT_ITEMS.length - created} already existed).`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
