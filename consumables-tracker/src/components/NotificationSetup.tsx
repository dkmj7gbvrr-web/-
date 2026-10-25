"use client";

import { useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription, hasPushSubscription } from "@/actions/push";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Status = "unsupported" | "checking" | "enabled" | "disabled";

/**
 * 通知の許可・Web Push購読を行うボタン。iPhoneの通常Safariタブでは
 * PushManagerが使えないため自動的に非表示になる(ホーム画面に追加した
 * アプリとして開いたときだけ表示される)。
 */
export function NotificationSetup({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function check() {
      if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          const stillSaved = await hasPushSubscription(existing.endpoint);
          setStatus(stillSaved ? "enabled" : "disabled");
        } else {
          setStatus("disabled");
        }
      } catch {
        setStatus("unsupported");
      }
    }
    check();
  }, [vapidPublicKey]);

  async function handleEnable() {
    if (!vapidPublicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("disabled");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("購読情報の取得に失敗しました");
      }
      await savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setStatus("enabled");
    } catch (error) {
      console.error(error);
      setStatus("disabled");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("disabled");
    } finally {
      setBusy(false);
    }
  }

  if (status === "unsupported" || status === "checking") return null;

  if (status === "enabled") {
    return (
      <button
        type="button"
        onClick={handleDisable}
        disabled={busy}
        className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-600 active:bg-slate-100"
      >
        通知：オン
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleEnable}
      disabled={busy}
      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 active:bg-slate-100"
    >
      通知を有効にする
    </button>
  );
}
