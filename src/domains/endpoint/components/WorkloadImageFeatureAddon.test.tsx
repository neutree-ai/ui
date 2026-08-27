import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RecipeFeature } from "@/foundation/recipe/types";

// The explorer has its own file and its own tests. Here it only has to appear
// when it should, and hand its answer back.
vi.mock("./ImageExplorerButton", () => ({
  ImageExplorerButton: ({
    onApply,
    registry,
  }: {
    onApply: (value: string) => void;
    registry?: string | null;
  }) => (
    <button
      type="button"
      data-testid="image-explorer-button"
      data-registry={registry}
      onClick={() => onApply("registry.example.com/team/x:v1")}
    >
      explore
    </button>
  ),
}));

import { WorkloadImageFeatureAddon } from "./WorkloadImageFeatureAddon";

/** The shape a real Flex catalog uses: the feature's input becomes the whole
 * `image` engine argument. */
const imageFeature = (
  overrides: Partial<RecipeFeature> = {},
): RecipeFeature => ({
  name: "image",
  type: "input",
  display_name: "工作负载镜像",
  engine_args: { image: "${value}" },
  ...overrides,
});

function renderAddon({
  engine = "flex" as string | null | undefined,
  feature = imageFeature(),
  registry = "cluster-hub" as string | null,
} = {}) {
  const onChange = vi.fn();

  render(
    <WorkloadImageFeatureAddon
      engine={engine}
      feature={feature}
      workspace="default"
      registry={registry}
      onChange={onChange}
    />,
  );

  return { onChange };
}

const explorer = () => screen.queryByTestId("image-explorer-button");

describe("WorkloadImageFeatureAddon", () => {
  it("offers the explorer for a Flex feature that writes the whole image", () => {
    // The catalog path is the one that needs it: its default is routinely a
    // placeholder the user is required to replace, with nothing to replace it
    // from.
    renderAddon();

    expect(explorer()).toBeTruthy();
  });

  it("writes back what the explorer found, fully qualified", () => {
    const { onChange } = renderAddon();

    fireEvent.click(explorer() as HTMLElement);

    expect(onChange).toHaveBeenCalledWith("registry.example.com/team/x:v1");
  });

  it("passes the cluster's registry through to be marked", () => {
    renderAddon({ registry: "cluster-hub" });

    expect(explorer()?.getAttribute("data-registry")).toBe("cluster-hub");
  });

  it("stays away when the input is only part of the reference", () => {
    // `myprefix/${value}` means the user supplies one component, not a whole
    // reference. Replacing that with something producing fully-qualified
    // references would quietly corrupt the value, so the plain input stands.
    renderAddon({
      feature: imageFeature({ engine_args: { image: "myprefix/${value}" } }),
    });

    expect(explorer()).toBeNull();
  });

  it("stays away for an engine that is not Flex", () => {
    // Another engine's `image` argument, if it has one, is not known to mean
    // the same thing.
    renderAddon({ engine: "vllm" });

    expect(explorer()).toBeNull();
  });

  it("stays away when nothing says the engine yet", () => {
    renderAddon({ engine: null });

    expect(explorer()).toBeNull();
  });

  it("stays away from a feature that writes some other argument", () => {
    renderAddon({
      feature: imageFeature({ engine_args: { command: "${value}" } }),
    });

    expect(explorer()).toBeNull();
  });
});
