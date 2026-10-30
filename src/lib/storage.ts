import "server-only";
import { randomUUID } from "node:crypto";
import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";

// Neon Object Storage, private bucket declared in neon.ts. Credentials come from
// the AWS_* variables that `neon deploy` / `neon env pull` write.
let receipts: Files | undefined;
function bucket() {
  receipts ??= new Files({ adapter: neon({ bucket: "receipts" }) });
  return receipts;
}

export const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Stores a teller photo and returns its object key (saved on the payment row).
export async function saveReceipt(
  file: unknown,
  cycleId: number,
  round: number,
): Promise<{ key: string } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Attach a photo of the teller." };
  const ext = EXTENSIONS[file.type];
  if (!ext) return { error: "The receipt must be a JPEG, PNG or WebP photo." };
  if (file.size > MAX_RECEIPT_BYTES) return { error: "That photo is too large (3 MB max)." };

  const key = `${cycleId}/${round}/${randomUUID()}.${ext}`;
  await bucket().upload(key, new Uint8Array(await file.arrayBuffer()), { contentType: file.type });
  return { key };
}

// A short-lived link to view a receipt.
export function receiptLink(key: string): Promise<string> {
  return bucket().url(key, { expiresIn: 15 * 60 });
}
