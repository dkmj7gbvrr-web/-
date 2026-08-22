import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: {
      delegation: {
        include: { task: { select: { ownerId: true, assigneeId: true } } },
      },
    },
  });

  if (!attachment || !attachment.delegation) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { delegation } = attachment;
  const allowed =
    user.id === delegation.fromUserId ||
    user.id === delegation.toUserId ||
    user.id === delegation.task.ownerId ||
    user.id === delegation.task.assigneeId;

  if (!allowed) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(attachment.data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.size),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
