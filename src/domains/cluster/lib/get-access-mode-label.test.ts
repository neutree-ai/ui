import { describe, expect, it, vi } from "vitest";
import { getAccessModeLabel } from "./get-access-mode-label";

const t = vi.fn((key: string) => key);

describe("getAccessModeLabel", () => {
  it.each(["LoadBalancer", "NodePort", "Ingress"])(
    "returns translated label for %s",
    (mode) => {
      getAccessModeLabel(mode, t);
      expect(t).toHaveBeenCalledWith(`status.accessModes.${mode}`);
    },
  );

  it("returns '-' for unknown mode", () => {
    expect(getAccessModeLabel("ClusterIP", t)).toBe("-");
  });

  it("returns '-' for undefined mode", () => {
    expect(getAccessModeLabel(undefined, t)).toBe("-");
  });

  it("returns '-' for empty string", () => {
    expect(getAccessModeLabel("", t)).toBe("-");
  });
});
