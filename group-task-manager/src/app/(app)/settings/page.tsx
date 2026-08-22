import { requireUser } from "@/lib/session";
import { signOutAction } from "@/actions/identity";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card } from "@/components/ui";
import { RenameForm } from "@/components/RenameForm";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader title="設定" />
      <div className="flex flex-col gap-5 px-4 py-4">
        <Card className="p-4">
          <h2 className="mb-3 text-[15px] font-semibold">表示名</h2>
          <RenameForm name={user.name} />
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-[15px] font-semibold">この端末について</h2>
          <p className="mb-3 text-[12px] leading-relaxed text-muted">
            あなたはこのブラウザに保存された情報で識別されています。別の端末や別のブラウザから開くと別の人として扱われるため、その端末でもう一度名前を入力し、参加コードでグループに入り直してください。
          </p>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary" className="w-full">
              この端末からログアウト
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
