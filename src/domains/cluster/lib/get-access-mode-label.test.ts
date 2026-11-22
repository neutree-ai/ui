import { describe, expect, it } from "vitest";
import { getAccessModeLabel } from "./get-access-mode-label";

const t = (key: string) => key;

describe("getAccessModeLabel", () => {
  it.each([
    ["LoadBalancer", "status.accessModes.LoadBalancer"],
    ["NodePort", "status.accessModes.NodePort"],
    ["Ingress", "status.accessModes.Ingress"],
    ["ClusterIP", undefined],
    [undefined, undefined],
    ["", undefined],
  ])("labels %j as %s", (mode, label) => {
    expect(getAccessModeLabel(mode, t)).toBe(label);
  });
});
