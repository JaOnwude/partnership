// Nigerian mobile numbers are stored in local 11-digit form (0803...).
// Accepts spaces, dashes, and +234 / 234 prefixes. Returns null if invalid.
export function normalisePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) digits = "0" + digits.slice(3);
  return /^0\d{10}$/.test(digits) ? digits : null;
}
