import { describe, expect, it } from "vitest";
import { middleTruncate } from "@/foundation/lib/middle-truncate";

describe("middleTruncate", () => {
  it("leaves a value that fits untouched", () => {
    expect(middleTruncate("https://huggingface.co", 44)).toEqual({
      text: "https://huggingface.co",
      truncated: false,
    });
  });

  it("leaves a value exactly at the limit untouched", () => {
    const value = "nfs://10.24.8.31/srv/models";

    expect(value).toHaveLength(27);
    expect(middleTruncate(value, 27)).toEqual({
      text: value,
      truncated: false,
    });
  });

  it("keeps the scheme and the last segment, dropping the middle", () => {
    expect(
      middleTruncate("nfs://models.internal/volumes/models/registry/prod", 44)
        .text,
    ).toBe("nfs://models.internal/…models/registry/prod");
  });

  it("cuts at a separator rather than inside a segment", () => {
    const { text } = middleTruncate(
      "https://hf.example/proxy/huggingface/models/tree/main",
      44,
    );

    // The head ends on a slash before the budget, not mid-host.
    expect(text).toBe("https://hf.example/…models/tree/main");
  });

  it("never returns more characters than the limit", () => {
    const value =
      "nfs://models.internal/volumes/ai/models/registry/2026q3/production/weights";

    for (const max of [16, 20, 24, 32, 44, 56, 64]) {
      const { text, truncated } = middleTruncate(value, max);
      expect(truncated).toBe(true);
      expect(text.length).toBeLessThanOrEqual(max);
      expect(text).toContain("…");
      expect(text.startsWith("nfs://")).toBe(true);
      expect(text.endsWith("weights")).toBe(true);
    }
  });

  it("handles a value with no scheme and no separator", () => {
    expect(middleTruncate("abcdefghijklmnop", 8).text).toBe("abcd…nop");
  });

  it("degrades to just the ellipsis when there is no room for anything else", () => {
    expect(middleTruncate("https://huggingface.co", 1).text).toBe("…");
    expect(middleTruncate("https://huggingface.co", 0)).toEqual({
      text: "https://huggingface.co",
      truncated: false,
    });
  });
});
