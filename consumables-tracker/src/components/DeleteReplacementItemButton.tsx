"use client";

import { deleteReplacementItem } from "@/actions/replacementItems";

export function DeleteReplacementItemButton({ itemId }: { itemId: string }) {
  return (
    <form
      action={deleteReplacementItem}
      onSubmit={(event) => {
        if (!confirm("この品目を削除しますか？")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={itemId} />
      <button
        type="submit"
        className="w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-600 active:bg-red-50"
      >
        削除する
      </button>
    </form>
  );
}
