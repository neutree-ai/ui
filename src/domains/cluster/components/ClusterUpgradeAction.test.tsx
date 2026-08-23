import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cluster } from "@/domains/cluster/types";

const mocks = vi.hoisted(() => ({
  availableVersions: [] as string[],
  invalidate: vi.fn(),
  mutateAsync: vi.fn(),
  useCustom: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useCustom: mocks.useCustom,
  useInvalidate: () => mocks.invalidate,
  useUpdate: () => ({ mutateAsync: mocks.mutateAsync, isLoading: false }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/combobox", () => ({
  Combobox: ({
    onChange,
    options,
    value,
  }: {
    onChange: (value: string) => void;
    options: { label: string; value: string }[];
    value: string;
  }) => (
    <select
      aria-label="target-version"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: ReactNode;
    onSelect: () => void;
  }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
}));

import {
  ClusterUpgradeAction,
  ClusterUpgradeProvider,
} from "./ClusterUpgradeAction";

const cluster = {
  api_version: "v1",
  id: 1,
  kind: "Cluster",
  metadata: { name: "cluster-a", workspace: "default" },
  spec: {
    config: {},
    image_registry: "registry-a",
    type: "ssh",
    version: "v1.1.0",
  },
  status: null,
} as Cluster;

function renderUpgradeAction() {
  return render(
    <ClusterUpgradeProvider>
      <ClusterUpgradeAction cluster={cluster} />
    </ClusterUpgradeProvider>,
  );
}

describe("ClusterUpgradeAction", () => {
  beforeEach(() => {
    mocks.availableVersions = [];
    mocks.invalidate.mockReset().mockResolvedValue(undefined);
    mocks.mutateAsync.mockReset().mockResolvedValue({});
    mocks.useCustom.mockImplementation(() => ({
      data: { data: { available_versions: mocks.availableVersions } },
      isLoading: false,
    }));
    mocks.useCustom.mockClear();
  });

  it("requests versions for the cluster type when the dialog opens", async () => {
    renderUpgradeAction();

    fireEvent.click(
      screen.getByRole("button", { name: "clusters.actions.upgrade" }),
    );

    await screen.findByRole("dialog");
    expect(mocks.useCustom).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: "/clusters/available_versions?workspace=default&image_registry=registry-a&cluster_type=ssh",
        queryOptions: { enabled: true },
      }),
    );
  });

  it("only offers newer versions and selects the highest result", async () => {
    mocks.availableVersions = ["v1.2.0", "v1.0.2", "v1.1.0"];
    renderUpgradeAction();

    fireEvent.click(
      screen.getByRole("button", { name: "clusters.actions.upgrade" }),
    );

    const targetVersion = await screen.findByLabelText("target-version");
    expect((targetVersion as HTMLSelectElement).value).toBe("v1.2.0");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "v1.2.0" })).toBeTruthy();
  });

  it("submits the selected newer version and refreshes cluster data", async () => {
    mocks.availableVersions = ["v1.2.0", "v1.0.2", "v1.1.0"];
    renderUpgradeAction();

    fireEvent.click(
      screen.getByRole("button", { name: "clusters.actions.upgrade" }),
    );
    await screen.findByLabelText("target-version");
    fireEvent.click(
      screen.getAllByRole("button", { name: "clusters.actions.upgrade" })[1],
    );

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({
            spec: expect.objectContaining({ version: "v1.2.0" }),
          }),
        }),
      );
    });
    expect(mocks.invalidate).toHaveBeenCalledWith({
      id: "cluster-a",
      invalidates: ["list", "detail"],
      resource: "clusters",
    });
  });
});
