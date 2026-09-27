"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { replacementItemInputSchema } from "@/lib/validation";
import { getDaysUntilDue, getNextDueDate, getUrgency } from "@/lib/replacement";

function parseLastReplacedAt(value: string): Date {
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() > today.getTime()) {
    throw new Error("前回交換日は今日以前の日付にしてください");
  }
  return date;
}

export async function createReplacementItem(formData: FormData) {
  const user = await requireUser();
  const parsed = replacementItemInputSchema.safeParse({
    name: formData.get("name"),
    intervalDays: formData.get("intervalDays"),
    lastReplacedAt: formData.get("lastReplacedAt"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }
  const lastReplacedAt = parseLastReplacedAt(parsed.data.lastReplacedAt);

  await prisma.replacementItem.create({
    data: {
      name: parsed.data.name,
      intervalDays: parsed.data.intervalDays,
      lastReplacedAt,
      lastUpdatedById: user.id,
      history: {
        create: { replacedAt: lastReplacedAt, userId: user.id },
      },
    },
  });

  revalidatePath("/replacements");
  redirect("/replacements");
}

export async function updateReplacementItem(formData: FormData) {
  await requireUser();
  const id = z.string().min(1).parse(formData.get("id"));
  const parsed = replacementItemInputSchema.pick({ name: true, intervalDays: true }).safeParse({
    name: formData.get("name"),
    intervalDays: formData.get("intervalDays"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  await prisma.replacementItem.update({
    where: { id },
    data: { name: parsed.data.name, intervalDays: parsed.data.intervalDays },
  });

  revalidatePath("/replacements");
  redirect("/replacements");
}

export async function deleteReplacementItem(formData: FormData) {
  await requireUser();
  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.replacementItem.delete({ where: { id } });
  revalidatePath("/replacements");
  redirect("/replacements");
}

/** 一覧からのワンタップ「交換した」。前回交換日を今日に更新する。 */
export async function markReplaced(formData: FormData) {
  const user = await requireUser();
  const id = z.string().min(1).parse(formData.get("id"));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.replacementItem.update({
    where: { id },
    data: {
      lastReplacedAt: today,
      lastUpdatedById: user.id,
      history: {
        create: { replacedAt: today, userId: user.id },
      },
    },
  });

  revalidatePath("/replacements");
}

export async function listReplacementItems() {
  const items = await prisma.replacementItem.findMany({
    include: { lastUpdatedBy: { select: { id: true, name: true } } },
  });

  return items
    .map((item) => {
      const nextDueAt = getNextDueDate(item.lastReplacedAt, item.intervalDays);
      const daysUntilDue = getDaysUntilDue(nextDueAt);
      return { ...item, nextDueAt, daysUntilDue, urgency: getUrgency(daysUntilDue) };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export async function listReplacementHistory(itemId: string) {
  return prisma.replacementLogEntry.findMany({
    where: { itemId },
    include: { user: { select: { name: true } } },
    orderBy: { replacedAt: "desc" },
    take: 20,
  });
}
