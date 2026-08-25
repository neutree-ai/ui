import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkloadImageInput } from "./WorkloadImageInput";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const useCustom = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCustom: (args: unknown) => useCustom(args),
}));

function answer(tags?: string[], isFetching = false) {
  useCustom.mockReturnValue({
    data: tags ? { data: { tags } } : undefined,
    isFetching,
  });
}

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

describe("WorkloadImageInput", () => {
  it("stays typeable and reports what was typed", () => {
    answer([]);
    const { onChange } = renderInput();

    fireEvent.change(screen.getByDisplayValue("my-workload:v1"), {
      target: { value: "other/image:v9" },
    });

    expect(onChange).toHaveBeenCalledWith("other/image:v9");
  });

  it("offers the registry's other tags and applies one to the repository", () => {
    answer(["v1", "v2"]);
    const { onChange } = renderInput();

    // The tag already in the value is not offered back.
    expect(screen.queryByText("v1")).toBeNull();

    fireEvent.click(screen.getByText("v2"));

    expect(onChange).toHaveBeenCalledWith("my-workload:v2");
  });

  it("shows nothing extra when the registry cannot answer", () => {
    // A refusing registry means no suggestions, not an error: the field is the
    // user's to fill in either way.
    answer(undefined);
    renderInput();

    expect(screen.queryByTestId("workload-image-tag-suggestions")).toBeNull();
    expect(screen.getByDisplayValue("my-workload:v1")).toBeTruthy();
  });

  it("asks for nothing until there is a repository and a registry to ask", () => {
    answer(undefined);
    renderInput({ value: "", registry: null });

    expect(useCustom).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "",
        queryOptions: expect.objectContaining({ enabled: false }),
      }),
    );
  });

  it("encodes a repository that contains slashes into one path segment", () => {
    answer([]);
    renderInput({ value: "team/inner:v1" });

    expect(useCustom).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/workspaces/default/image_registries/hub/repositories/team%2Finner/tags",
      }),
    );
  });
});
