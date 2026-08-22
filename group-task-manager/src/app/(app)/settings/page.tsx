import { requireUser } from "@/lib/session";
import { signOutAction } from "@/actions/identity";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card } from "@/components/ui";
import { RenameForm } from "@/components/RenameForm";
import { CopyCodeButton } from "@/components/CopyCodeButton";

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
          <h2 className="mb-2 text-[15px] font-semibold">ログインコード</h2>
          <p className="mb-3 text-[12px] leading-relaxed text-muted">
            別の端末から開いたときや、この端末のデータを消してしまったときに、このコードで同じアカウントに戻れます。忘れずに控えておいてください。
          </p>
          {user.loginCode ? (
            <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-4">
              <p className="flex-1 text-center text-[17px] font-bold tracking-[0.08em] text-accent">
                {user.loginCode}
              </p>
              <CopyCodeButton code={user.loginCode} />
            </div>
          ) : (
            <p className="rounded-xl bg-surface-2 p-4 text-center text-[13px] text-muted">
              このアカウントにはログインコードがありません
            </p>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-[15px] font-semibold">この端末について</h2>
          <p className="mb-3 text-[12px] leading-relaxed text-muted">
            あなたはこのブラウザに保存された情報で識別されています。ログアウトしても上のログインコードがあれば、いつでも同じアカウントに戻れます。
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
