import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:notifications@consumables-tracker.local";

export const isPushConfigured = (() => {
  if (!vapidPublicKey || !vapidPrivateKey) return false;
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    return true;
  } catch (error) {
    // VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY の値がおかしい(コピペミスなど)場合に
    // ビルド/サイト全体を落とさず、通知機能だけを無効にする。
    console.error("Invalid VAPID keys; push notifications are disabled.", error);
    return false;
  }
})();

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export type PushSendResult = {
  configured: boolean;
  subscriptionCount: number;
  results: { endpointSuffix: string; ok: boolean; statusCode?: number; message?: string }[];
};

/**
 * 条件に合う購読すべてにプッシュ通知を送る。送信に失敗した(410/404など
 * 無効になった)購読は削除する。excludeUserId を指定すると、その本人の
 * 端末には送らない(自分の操作による通知は不要なため)。
 * 戻り値は /api/cron/check-replacements の手動デバッグ用に、各購読への
 * 送信結果を含む(endpointは末尾12文字だけに丸めて返す)。
 */
export async function sendPushNotification(
  payload: PushPayload,
  options: { excludeUserId?: string } = {},
): Promise<PushSendResult> {
  if (!isPushConfigured) {
    return { configured: false, subscriptionCount: 0, results: [] };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: options.excludeUserId ? { userId: { not: options.excludeUserId } } : undefined,
  });

  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      const endpointSuffix = sub.endpoint.slice(-12);
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
        return { endpointSuffix, ok: true };
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        const message = error instanceof Error ? error.message : String(error);
        // 404/410(購読が無効になった)や400(壊れた購読情報)は自動で削除する。
        if (statusCode === 404 || statusCode === 410 || statusCode === 400) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("Failed to send push notification", error);
        }
        return { endpointSuffix, ok: false, statusCode, message };
      }
    }),
  );

  return { configured: true, subscriptionCount: subscriptions.length, results };
}
