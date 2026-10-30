import { describe, expect, it } from "vitest";
import { canAdminister, effectiveRole } from "./roles";

describe("roles", () => {
  it("lets a delegate admin act only while enabled", () => {
    expect(effectiveRole({ role: "admin", delegateEnabled: false })).toBe("member");
    expect(effectiveRole({ role: "admin", delegateEnabled: true })).toBe("admin");
  });

  it("keeps owner and member roles unchanged", () => {
    expect(effectiveRole({ role: "owner", delegateEnabled: false })).toBe("owner");
    expect(effectiveRole({ role: "member", delegateEnabled: true })).toBe("member");
  });

  it("only owner and admin can administer", () => {
    expect(canAdminister("owner")).toBe(true);
    expect(canAdminister("admin")).toBe(true);
    expect(canAdminister("member")).toBe(false);
  });
});
