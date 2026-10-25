"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function savePushSubscription(subscription: PushSubscriptionInput) {
  const user = await requireUser();

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { userId: user.id, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    create: {
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

export async function removePushSubscription(endpoint: string) {
  await requireUser();
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export async function hasPushSubscription(endpoint: string) {
  await requireUser();
  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
  return existing !== null;
}
