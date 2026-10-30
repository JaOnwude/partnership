import { describe, expect, it } from "vitest";
import { normalisePhone } from "./phone";

describe("normalisePhone", () => {
  it("normalises international and spaced formats", () => {
    expect(normalisePhone("+234 707 740 7381")).toBe("07077407381");
    expect(normalisePhone("0707-740-7381")).toBe("07077407381");
    expect(normalisePhone("2347077407381")).toBe("07077407381");
  });

  it("rejects numbers that are too short or malformed", () => {
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("")).toBeNull();
  });
});
