import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getAccessModeLabel } from "./get-access-mode-label";

const t = (key: string) => key;

describe("getAccessModeLabel", () => {
  it.each([
    ["LoadBalancer", "status.accessModes.LoadBalancer"],
    ["NodePort", "status.accessModes.NodePort"],
    ["Ingress", "status.accessModes.Ingress"],
    ["ClusterIP", "-"],
    [undefined, "-"],
    ["", "-"],
  ])("renders %j as %s", (mode, label) => {
    const { container } = render(<>{getAccessModeLabel(mode, t)}</>);
    expect(container.textContent).toBe(label);
  });
});
