import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logoutAction } from "@/actions/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, Button } from "@/components/ui";
import { ProfileForm } from "@/components/ProfileForm";

export default async function SettingsPage() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  return (
    <>
      <PageHeader title="設定" />
      <div className="flex flex-col gap-5 px-4 py-4">
        <Card className="p-4">
          <h2 className="mb-3 text-[15px] font-semibold">プロフィール</h2>
          <ProfileForm name={dbUser.name} teamsWebhookUrl={dbUser.teamsWebhookUrl ?? ""} />
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-[13px] text-muted">{dbUser.email}</p>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary" className="w-full">
              ログアウト
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
