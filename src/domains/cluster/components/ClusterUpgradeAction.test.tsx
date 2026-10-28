import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cluster } from "@/domains/cluster/types";

const mocks = vi.hoisted(() => ({
  availableVersions: [] as string[],
  invalidate: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useCustom: () => ({
    data: { data: { available_versions: mocks.availableVersions } },
    isLoading: false,
  }),
  useInvalidate: () => mocks.invalidate,
  useUpdate: () => ({ mutateAsync: mocks.mutateAsync, isLoading: false }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
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
  });

  it("offers only newer versions and submits the highest, then refreshes cluster data", async () => {
    mocks.availableVersions = ["v1.2.0", "v1.0.2", "v1.1.0"];
    renderUpgradeAction();

    fireEvent.click(
      screen.getByRole("button", { name: "clusters.actions.upgrade" }),
    );
    const targetVersion = await screen.findByLabelText("target-version");
    expect((targetVersion as HTMLSelectElement).value).toBe("v1.2.0");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["v1.2.0"]);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "clusters.actions.upgrade",
      }),
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
