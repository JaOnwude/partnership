import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for small secrets kept in the database (members' bank details).
// The key lives only in the server environment, so a database leak alone doesn't expose them.
function key(): Buffer {
  const hex = process.env.BANK_DETAILS_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) throw new Error("BANK_DETAILS_KEY must be 64 hex characters");
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

export function decrypt(token: string): string {
  const [iv, tag, body] = token.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

export type BankDetails = { bank: string; number: string; name: string };

export function sealBankDetails(details: BankDetails): string {
  return encrypt(JSON.stringify(details));
}

export function openBankDetails(token: string | null): BankDetails | null {
  if (!token) return null;
  try {
    return JSON.parse(decrypt(token)) as BankDetails;
  } catch {
    return null;
  }
}
