export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB

export type ReadAttachmentResult =
  | { ok: true; file: { filename: string; mimeType: string; size: number; data: Uint8Array } }
  | { ok: true; file: null }
  | { ok: false; error: string };

/** フォームから任意の添付ファイルを読み取る。未選択なら file: null。 */
export async function readOptionalAttachment(
  formData: FormData,
  field: string
): Promise<ReadAttachmentResult> {
  const value = formData.get(field);

  if (!(value instanceof File) || value.size === 0) {
    return { ok: true, file: null };
  }

  if (value.size > MAX_ATTACHMENT_SIZE) {
    return { ok: false, error: "添付ファイルは5MB以内にしてください" };
  }

  const data = new Uint8Array(await value.arrayBuffer());
  return {
    ok: true,
    file: {
      filename: value.name || "attachment",
      mimeType: value.type || "application/octet-stream",
      size: value.size,
      data,
    },
  };
}
