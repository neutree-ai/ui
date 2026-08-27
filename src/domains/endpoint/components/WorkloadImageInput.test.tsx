import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", async () => {
  const en = (await import("@/locales/en-US.json")).default as Record<
    string,
    unknown
  >;

  const lookup = (key: string): string | undefined => {
    const found = key
      .split(".")
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        en,
      );

    return typeof found === "string" ? found : undefined;
  };

  return {
    useTranslation: () => ({ t: (key: string) => lookup(key) ?? key }),
  };
});

// The explorer has its own file and its own tests. Here it only has to stay
// shut until it is asked for, and to hand its answer back.
vi.mock("./ImageRegistryExplorerDialog", () => ({
  ImageRegistryExplorerDialog: ({
    open,
    clusterRegistry,
    onApply,
  }: {
    open: boolean;
    clusterRegistry?: string | null;
    onApply: (value: string) => void;
  }) =>
    open ? (
      <div data-testid="image-explorer" data-cluster-registry={clusterRegistry}>
        <button type="button" onClick={() => onApply("registry.io/team/x:v1")}>
          apply
        </button>
      </div>
    ) : null,
}));

import { WorkloadImageInput } from "./WorkloadImageInput";

function renderInput(
  props: Partial<Parameters<typeof WorkloadImageInput>[0]> = {},
) {
  const onChange = vi.fn();

  render(
    <WorkloadImageInput
      value="my-workload:v1"
      onChange={onChange}
      workspace="default"
      registry="hub"
      {...props}
    />,
  );

  return { onChange };
}

const openButton = () =>
  screen.getByRole("button", { name: /Explore image registry/ });

describe("WorkloadImageInput", () => {
  it("stays a plain text box and reports what was typed", () => {
    const { onChange } = renderInput();

    fireEvent.change(screen.getByDisplayValue("my-workload:v1"), {
      target: { value: "other/image:v9" },
    });

    expect(onChange).toHaveBeenCalledWith("other/image:v9");
  });

  it("asks for nothing on its own", () => {
    // Nothing is inferred from a half-typed value and nothing is fetched per
    // keystroke: the box is a box, and looking things up happens in the
    // explorer.
    renderInput({ value: "team/inner" });

    expect(screen.queryByTestId("image-explorer")).toBeNull();
  });

  it("opens the explorer and writes back what it returns", () => {
    const { onChange } = renderInput();

    fireEvent.click(openButton());
    fireEvent.click(screen.getByText("apply"));

    expect(onChange).toHaveBeenCalledWith("registry.io/team/x:v1");
  });

  it("offers the explorer with no cluster picked", () => {
    // The registry is chosen inside the explorer, so this field does not need
    // one to be useful. It used to be dead without a cluster.
    renderInput({ registry: null });

    expect((openButton() as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(openButton());

    expect(
      screen
        .getByTestId("image-explorer")
        .getAttribute("data-cluster-registry"),
    ).toBeNull();
  });

  it("tells the explorer which registry the cluster uses", () => {
    renderInput({ registry: "cluster-hub" });

    fireEvent.click(openButton());

    expect(
      screen
        .getByTestId("image-explorer")
        .getAttribute("data-cluster-registry"),
    ).toBe("cluster-hub");
  });
});
