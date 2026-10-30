import "server-only";
import { randomUUID } from "node:crypto";
import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";

// Neon Object Storage, private bucket declared in neon.ts. Locally the credentials are
// the AWS_* variables `neon env pull` writes. On Vercel those names are reserved (and
// the runtime sets its own AWS keys), so production uses NEON_STORAGE_* instead.
let receipts: Files | undefined;
function bucket() {
  const env = process.env;
  receipts ??= new Files({
    adapter: neon({
      bucket: "receipts",
      endpoint: env.NEON_STORAGE_ENDPOINT ?? env.AWS_ENDPOINT_URL_S3,
      region: env.NEON_STORAGE_REGION ?? env.AWS_REGION,
      accessKeyId: env.NEON_STORAGE_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.NEON_STORAGE_SECRET_ACCESS_KEY ?? env.AWS_SECRET_ACCESS_KEY,
    }),
  });
  return receipts;
}

export const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Stores a teller (or payout transfer) photo and returns its object key, saved on the row.
export async function saveReceipt(
  file: unknown,
  cycleId: number,
  round: number,
  folder: "tellers" | "payouts" = "tellers",
): Promise<{ key: string } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Attach a photo of the receipt." };
  const ext = EXTENSIONS[file.type];
  if (!ext) return { error: "The receipt must be a JPEG, PNG or WebP photo." };
  if (file.size > MAX_RECEIPT_BYTES) return { error: "That photo is too large (3 MB max)." };

  const key = `${folder}/${cycleId}/${round}/${randomUUID()}.${ext}`;
  await bucket().upload(key, new Uint8Array(await file.arrayBuffer()), { contentType: file.type });
  return { key };
}

// A short-lived link to view a receipt.
export function receiptLink(key: string): Promise<string> {
  return bucket().url(key, { expiresIn: 15 * 60 });
}
