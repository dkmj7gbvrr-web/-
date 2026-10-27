import { NextRequest, NextResponse } from "next/server";
import { listReplacementItems } from "@/actions/replacementItems";
import { sendPushNotification } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Vercel Cronから毎日呼ばれる。期限切れ/もうすぐの定期交換品があれば
 * まとめて1通の通知を送る(ユーザーごとの除外はせず、両方に送る)。
 *
 * 手動デバッグ用に、Authorization: Bearer <secret> の代わりに
 * ?secret=<secret> クエリでも認証できる(ブラウザで直接開いて結果を
 * 確認できるようにするため)。
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secretParam = request.nextUrl.searchParams.get("secret");
  const secret = process.env.CRON_SECRET;
  const authorized = Boolean(secret) && (authHeader === `Bearer ${secret}` || secretParam === secret);

  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const items = await listReplacementItems();
  const urgent = items.filter((item) => item.urgency !== "OK");

  if (urgent.length === 0) {
    return NextResponse.json({ sent: false, urgentCount: 0 });
  }

  const label = urgent.length === 1 ? urgent[0].name : `${urgent[0].name} 他${urgent.length - 1}件`;

  const push = await sendPushNotification({
    title: "定期交換品の交換時期です",
    body: `${label}の交換時期になっています`,
    url: "/replacements",
  });

  return NextResponse.json({
    sent: true,
    urgentCount: urgent.length,
    urgentNames: urgent.map((item) => item.name),
    push,
  });
}
