import { describe, expect, it } from "vitest";
import { cleanUpstreamsForSubmit } from "./clean-upstreams-for-submit";

describe("cleanUpstreamsForSubmit", () => {
  const baseUpstream = {
    upstream: { url: "https://api.openai.com" },
    auth: { type: "bearer", credential: "" },
    model_mapping: { "gpt-4o": "gpt-4o" },
    models: null,
  };

  describe("create mode (isEdit=false)", () => {
    it("preserves empty credentials", () => {
      const result = cleanUpstreamsForSubmit([baseUpstream], false);
      expect(result[0].auth).toEqual({ type: "bearer", credential: "" });
    });

    it("preserves non-empty credentials", () => {
      const upstream = {
        ...baseUpstream,
        auth: { type: "bearer", credential: "sk-123" },
      };
      const result = cleanUpstreamsForSubmit([upstream], false);
      expect(result[0].auth?.credential).toBe("sk-123");
    });
  });

  describe("edit mode (isEdit=true)", () => {
    it("removes empty credential so backend retains existing value", () => {
      const result = cleanUpstreamsForSubmit([baseUpstream], true);
      expect(result[0].auth).toEqual({ type: "bearer" });
      expect("credential" in (result[0].auth ?? {})).toBe(false);
    });

    it("preserves non-empty credential", () => {
      const upstream = {
        ...baseUpstream,
        auth: { type: "bearer", credential: "new-secret" },
      };
      const result = cleanUpstreamsForSubmit([upstream], true);
      expect(result[0].auth?.credential).toBe("new-secret");
    });

    it("handles upstream with null auth", () => {
      const upstream = { ...baseUpstream, auth: null };
      const result = cleanUpstreamsForSubmit([upstream], true);
      expect(result[0].auth).toBeNull();
    });

    it("handles multiple upstreams independently", () => {
      const upstreams = [
        { ...baseUpstream, auth: { type: "bearer", credential: "" } },
        {
          ...baseUpstream,
          auth: { type: "basic", credential: "keep-this" },
        },
        { ...baseUpstream, auth: null },
      ];
      const result = cleanUpstreamsForSubmit(upstreams, true);
      expect("credential" in (result[0].auth ?? {})).toBe(false);
      expect(result[1].auth?.credential).toBe("keep-this");
      expect(result[2].auth).toBeNull();
    });
  });
});
