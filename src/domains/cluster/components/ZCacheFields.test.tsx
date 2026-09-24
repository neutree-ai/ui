import type { UseFormReturnType } from "@refinedev/react-hook-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { Cluster, ZCacheStatus } from "../types";
import { ZCacheFields } from "./ZCacheFields";

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function Form({
  onSubmit,
  status,
  isEdit = true,
}: {
  onSubmit: (data: Cluster) => void;
  status?: ZCacheStatus;
  isEdit?: boolean;
}) {
  const form = useForm<Cluster>({
    defaultValues: {
      spec: {
        type: "kubernetes",
        zcache: { enabled: true, l1_size_gib: 8, target_nodes: ["a", "b"] },
      },
    },
  });
  const adapted = Object.assign(form, {
    refineCore: { query: { data: { data: { status: { zcache: status } } } } },
  }) as unknown as UseFormReturnType<Cluster>;
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <ZCacheFields form={adapted} isEdit={isEdit} />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}
const observed: ZCacheStatus = {
  phase: "Applied",
  candidates: [
    { name: "a", selectable: true },
    { name: "b", selectable: false },
    { name: "c", selectable: true },
  ],
  nodes: [
    {
      name: "a",
      runtime: "Ready",
      cache: "Available",
      capacity_bytes: 8 * 2 ** 30,
    },
    {
      name: "b",
      runtime: "NotReady",
      cache: "Unavailable",
      capacity_bytes: 8 * 2 ** 30,
    },
  ],
};

describe("ZCacheFields", () => {
  it("sends a numeric capacity and preserves the successful node when removing a failed node", async () => {
    const submit = vi.fn();
    render(<Form onSubmit={submit} status={observed} />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "b" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0].spec.zcache).toEqual({
      enabled: true,
      l1_size_gib: 1,
      target_nodes: ["a"],
    });
  });
  it("offers undeployed candidates, not just runtime nodes", () => {
    render(<Form onSubmit={vi.fn()} status={observed} />);
    expect(screen.getByRole("checkbox", { name: "c" })).toHaveProperty(
      "disabled",
      false,
    );
  });
  it("keeps selected nodes visible during inventory failure and prevents adding stale candidates", () => {
    render(
      <Form
        onSubmit={vi.fn()}
        status={{ ...observed, observation_error: "unavailable" }}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "a" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByRole("checkbox", { name: "c" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("alert").textContent).toContain("unavailable");
  });
  it("rejects fractional capacity and empty selection", async () => {
    const submit = vi.fn();
    render(<Form onSubmit={submit} status={observed} />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "1.5" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "a" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "b" }));
    fireEvent.submit(
      screen.getByRole("button", { name: "Save" }).closest("form")!,
    );
    await waitFor(() =>
      expect(screen.getByText("clusters.zcache.invalidCapacity")).toBeTruthy(),
    );
    expect(submit).not.toHaveBeenCalled();
  });
  it("explains bootstrap before enabling runtime on a new cluster", () => {
    render(<Form onSubmit={vi.fn()} isEdit={false} />);
    expect(screen.getByText("clusters.zcache.createHint")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
