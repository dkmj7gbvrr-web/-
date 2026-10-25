import { NextRequest, NextResponse } from "next/server";
import { listReplacementItems } from "@/actions/replacementItems";
import { sendPushNotification } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Vercel Cronから毎日呼ばれる。期限切れ/もうすぐの定期交換品があれば
 * まとめて1通の通知を送る(ユーザーごとの除外はせず、両方に送る)。
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const items = await listReplacementItems();
  const urgent = items.filter((item) => item.urgency !== "OK");

  if (urgent.length === 0) {
    return NextResponse.json({ sent: false, urgentCount: 0 });
  }

  const label = urgent.length === 1 ? urgent[0].name : `${urgent[0].name} 他${urgent.length - 1}件`;

  await sendPushNotification({
    title: "定期交換品の交換時期です",
    body: `${label}の交換時期になっています`,
    url: "/replacements",
  });

  return NextResponse.json({ sent: true, urgentCount: urgent.length });
}
