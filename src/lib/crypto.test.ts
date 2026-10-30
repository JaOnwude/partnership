import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt, openBankDetails, sealBankDetails } from "./crypto";

beforeAll(() => {
  process.env.BANK_DETAILS_KEY = "0".repeat(63) + "1";
});

describe("crypto", () => {
  it("round-trips and never stores plain text", () => {
    const token = encrypt("3212948937");
    expect(token).not.toContain("3212948937");
    expect(decrypt(token)).toBe("3212948937");
  });

  it("uses a fresh IV each time", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects tampered data", () => {
    const [iv, tag, body] = encrypt("secret").split(".");
    const flipped = Buffer.from(body, "base64");
    flipped[0] ^= 1;
    expect(() => decrypt([iv, tag, flipped.toString("base64")].join("."))).toThrow();
  });

  it("seals bank details and returns null for missing or corrupt values", () => {
    const details = { bank: "First Bank", number: "3212948937", name: "Test Name" };
    expect(openBankDetails(sealBankDetails(details))).toEqual(details);
    expect(openBankDetails(null)).toBeNull();
    expect(openBankDetails("not.a.token")).toBeNull();
  });
});
