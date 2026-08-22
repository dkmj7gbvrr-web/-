/**
 * Microsoft Teams の受信 Webhook (Incoming Webhook / Workflows) にメッセージを送る。
 * 送信先は各ユーザーがプロフィール設定で登録した個人の Webhook URL。
 * 失敗してもアプリ内通知は既に作成済みなので、ここでは例外を投げずログのみ残す。
 */

interface TeamsNotificationInput {
  webhookUrl: string;
  title: string;
  text: string;
  taskUrl?: string;
}

export async function sendTeamsNotification({
  webhookUrl,
  title,
  text,
  taskUrl,
}: TeamsNotificationInput): Promise<void> {
  const payload = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    summary: title,
    themeColor: "0A84FF",
    title,
    text,
    potentialAction: taskUrl
      ? [
          {
            "@type": "OpenUri",
            name: "タスクを見る",
            targets: [{ os: "default", uri: taskUrl }],
          },
        ]
      : undefined,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(
        `[teams] webhook returned ${res.status} ${res.statusText}`
      );
    }
  } catch (err) {
    console.error("[teams] failed to send notification", err);
  }
}
