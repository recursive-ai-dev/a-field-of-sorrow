import { describe, it, expect } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
    expect(cn("base", true && "extra")).toBe("base extra");
  });

  it("handles undefined and null", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });

  it("merges tailwind classes (last wins)", () => {
    expect(cn("px-4", "px-2")).toBe("px-2");
  });
});
