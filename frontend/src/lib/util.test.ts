import { describe, expect, it } from "vitest";
import { cx, fmtBytes, fmtTime, initials } from "./util";

describe("fmtTime", () => {
  it("formats seconds as m:ss", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(7.9)).toBe("0:07");
    expect(fmtTime(65)).toBe("1:05");
  });
  it("falls back to 0:00 for missing or non-finite input", () => {
    expect(fmtTime(null)).toBe("0:00");
    expect(fmtTime(undefined)).toBe("0:00");
    expect(fmtTime(Infinity)).toBe("0:00");
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Mrs. Okafor")).toBe("MO");
    expect(initials("Deacon James Hill")).toBe("DJ");
  });
  it("returns ? for an empty name", () => {
    expect(initials("   ")).toBe("?");
  });
});

describe("fmtBytes", () => {
  it("uses KB under 1 MB and MB above", () => {
    expect(fmtBytes(512 * 1024)).toBe("512 KB");
    expect(fmtBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});

describe("cx", () => {
  it("joins truthy class names", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });
});
