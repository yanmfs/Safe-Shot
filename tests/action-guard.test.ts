import { describe, expect, it } from "vitest";
import { firstOf } from "../src/features/actionGuard";

describe("firstOf", () => {
  it("lets the first arrival through and drops a duplicate within a blink", () => {
    expect(firstOf("t-undo", 1000)).toBe(true);
    expect(firstOf("t-undo", 1050)).toBe(false);
  });

  it("lets the same action run again once enough time has passed", () => {
    expect(firstOf("t-save", 2000)).toBe(true);
    expect(firstOf("t-save", 2500)).toBe(true);
  });

  it("does not mix up different actions", () => {
    expect(firstOf("t-a", 3000)).toBe(true);
    expect(firstOf("t-b", 3010)).toBe(true);
  });
});
