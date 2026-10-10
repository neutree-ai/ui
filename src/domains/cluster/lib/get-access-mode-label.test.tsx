import { render } from "@testing-library/react";
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

  it("renders the placeholder for unknown mode", () => {
    const { container } = render(<>{getAccessModeLabel("ClusterIP", t)}</>);
    expect(container.textContent).toBe("-");
  });

  it("renders the placeholder for undefined mode", () => {
    const { container } = render(<>{getAccessModeLabel(undefined, t)}</>);
    expect(container.textContent).toBe("-");
  });

  it("renders the placeholder for empty string", () => {
    const { container } = render(<>{getAccessModeLabel("", t)}</>);
    expect(container.textContent).toBe("-");
  });
});
