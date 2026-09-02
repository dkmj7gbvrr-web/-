"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { itemInputSchema, STATUS_VALUES } from "@/lib/validation";
import type { StockStatus } from "@/generated/prisma/enums";

/** 品目の新規追加。 */
export async function createItem(formData: FormData) {
  const user = await requireUser();
  const parsed = itemInputSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    status: formData.get("status") ?? "NORMAL",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  await prisma.item.create({
    data: {
      name: parsed.data.name,
      category: parsed.data.category,
      status: parsed.data.status,
      lastUpdatedById: user.id,
      history: {
        create: { toStatus: parsed.data.status, userId: user.id },
      },
    },
  });

  revalidatePath("/");
  redirect("/");
}

/** 品目名・カテゴリの編集(残量ステータスは変更しない = 更新履歴を汚さない)。 */
export async function updateItemDetails(formData: FormData) {
  await requireUser();
  const id = z.string().min(1).parse(formData.get("id"));
  const parsed = itemInputSchema.pick({ name: true, category: true }).safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  await prisma.item.update({
    where: { id },
    data: { name: parsed.data.name, category: parsed.data.category },
  });

  revalidatePath("/");
  redirect("/");
}

export async function deleteItem(formData: FormData) {
  await requireUser();
  const id = z.string().min(1).parse(formData.get("id"));
  await prisma.item.delete({ where: { id } });
  revalidatePath("/");
  redirect("/");
}

/** 一覧からのワンタップ残量更新。買い物リストの「買った」もこれを使う。 */
export async function setItemStatus(formData: FormData) {
  const user = await requireUser();
  const id = z.string().min(1).parse(formData.get("id"));
  const status = z.enum(STATUS_VALUES).parse(formData.get("status")) as StockStatus;

  const current = await prisma.item.findUnique({ where: { id }, select: { status: true } });
  if (!current) throw new Error("品目が見つかりません");
  if (current.status === status) return;

  await prisma.item.update({
    where: { id },
    data: {
      status,
      lastUpdatedById: user.id,
      history: {
        create: { fromStatus: current.status, toStatus: status, userId: user.id },
      },
    },
  });

  revalidatePath("/");
}

export async function listItems() {
  return prisma.item.findMany({
    include: { lastUpdatedBy: { select: { id: true, name: true } } },
    orderBy: [{ status: "desc" }, { category: "asc" }, { name: "asc" }],
  });
}

export async function listCategories() {
  const rows = await prisma.item.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}

export async function listItemHistory(itemId: string) {
  return prisma.statusHistoryEntry.findMany({
    where: { itemId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
