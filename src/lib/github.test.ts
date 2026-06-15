import { describe, expect, it } from "vitest";
import { decodeCursorOffset, encodeOffsetCursor, parseRepo, runPool } from "./github";

describe("cursor helpers", () => {
  it("round-trips an offset through encode/decode", () => {
    for (const n of [0, 50, 100, 12345]) {
      expect(decodeCursorOffset(encodeOffsetCursor(n))).toBe(n);
    }
  });

  it("encodes in GitHub's cursor:<n> base64 format", () => {
    expect(encodeOffsetCursor(50)).toBe(btoa("cursor:50"));
  });

  it("returns null for non-offset cursors", () => {
    expect(decodeCursorOffset(btoa("Y3Vyc29yOnYyOpK5"))).toBeNull(); // arbitrary
    expect(decodeCursorOffset(btoa("cursor:abc"))).toBeNull();
    expect(decodeCursorOffset("not base64 !!!")).toBeNull();
  });
});

describe("parseRepo", () => {
  it("parses owner/name", () => {
    expect(parseRepo("facebook/react")).toEqual({ owner: "facebook", name: "react" });
  });
  it("parses a full GitHub URL", () => {
    expect(parseRepo("https://github.com/facebook/react")).toEqual({
      owner: "facebook",
      name: "react",
    });
  });
  it("strips trailing .git and slashes", () => {
    expect(parseRepo("https://github.com/foo/bar.git/")).toEqual({
      owner: "foo",
      name: "bar",
    });
  });
  it("returns null for junk", () => {
    expect(parseRepo("nope")).toBeNull();
  });
});

describe("runPool", () => {
  it("processes every item", async () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const seen: number[] = [];
    await runPool(items, () => 6, async (n) => {
      seen.push(n);
    });
    expect(seen.sort((a, b) => a - b)).toEqual(items);
  });

  it("never exceeds the concurrency limit", async () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;
    await runPool(items, () => 4, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    });
    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it("propagates the first error after draining in-flight work", async () => {
    const items = [1, 2, 3, 4, 5];
    await expect(
      runPool(items, () => 2, async (n) => {
        if (n === 3) throw new Error("boom");
      })
    ).rejects.toThrow("boom");
  });

  it("stops scheduling once aborted", async () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const controller = new AbortController();
    let processed = 0;
    const p = runPool(
      items,
      () => 2,
      async () => {
        processed++;
        await new Promise((r) => setTimeout(r, 5));
        if (processed >= 4) controller.abort();
      },
      controller.signal
    );
    await p;
    expect(processed).toBeLessThan(items.length);
  });
});
