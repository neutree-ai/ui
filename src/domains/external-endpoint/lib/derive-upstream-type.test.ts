import { describe, expect, it } from "vitest";
import { deriveUpstreamType } from "./derive-upstream-type";

describe("deriveUpstreamType", () => {
  it('returns "external" when upstream is undefined', () => {
    expect(deriveUpstreamType(undefined)).toBe("external");
  });

  it('returns "external" when endpoint_ref is undefined', () => {
    expect(deriveUpstreamType({ endpoint_ref: undefined })).toBe("external");
  });

  it('returns "endpoint_ref" when endpoint_ref is empty string', () => {
    expect(deriveUpstreamType({ endpoint_ref: "" })).toBe("endpoint_ref");
  });

  it('returns "endpoint_ref" when endpoint_ref has a value', () => {
    expect(deriveUpstreamType({ endpoint_ref: "my-endpoint" })).toBe(
      "endpoint_ref",
    );
  });
});
