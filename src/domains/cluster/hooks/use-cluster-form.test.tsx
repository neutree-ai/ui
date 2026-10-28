import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectOption } from "@/foundation/testing/interactions";
import { renderForm } from "@/foundation/testing/render-form";

vi.mock("@refinedev/core", () => ({
  useList: () => ({ data: { data: [] }, isLoading: false }),
  useSelect: () => ({
    query: { data: { data: [] }, isLoading: false },
  }),
  useCustom: () => ({
    data: { data: { available_versions: [] } },
    isLoading: false,
  }),
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: vi.fn(() => ({ current: "default" })),
  isValidWorkspace: (v: string | undefined | null) => !!v && v !== "_all_",
}));

const nodeIPsFieldProps = vi.fn();
vi.mock("@/domains/cluster/components/NodeIPsField", () => ({
  default: (props: Record<string, unknown>) => {
    nodeIPsFieldProps(props);
    return <div data-testid="node-ips-field-mock" />;
  },
}));

vi.mock("@/domains/cluster/components/ModelCacheFields", () => ({
  ModelCacheFields: () => <div data-testid="model-cache-fields-mock" />,
}));

vi.mock("@/foundation/hooks/use-system-api", () => ({
  useSystemApi: vi.fn(() => ({
    systemInfo: { capabilities: { cluster_cache_providers: [] } },
  })),
}));

import { useSystemApi } from "@/foundation/hooks/use-system-api";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import { useClusterForm } from "./use-cluster-form";

const KUBECONFIG = "field-spec.config.kubernetes_config.kubeconfig";
const SSH_USER = "field-spec.config.ssh_config.auth.ssh_user";
const ACCEL = "field-spec.accelerator_virtualization.enabled";

const renderCluster = (action: "create" | "edit" = "create") =>
  renderForm(
    () => useClusterForm({ action }),
    (r) => (
      <>
        {r.metadataFields}
        {r.clusterConfigurationFields}
        {r.providerFields}
        {r.routerFields}
        {r.acceleratorVirtualizationFields}
        {r.authFields}
        {r.cacheFields}
      </>
    ),
  );

const switchType = (type: "kubernetes" | "multipleStaticNodes") =>
  selectOption("spec.type", `clusters.options.${type}`);

describe("useClusterForm", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(useWorkspace).mockReset();
    vi.mocked(useSystemApi).mockReset();
  });

  it.each([
    { action: "edit", locked: true },
    { action: "create", locked: false },
  ] as const)("locks the head IP on $action: $locked", ({ action, locked }) => {
    nodeIPsFieldProps.mockClear();
    renderCluster(action);
    const props = nodeIPsFieldProps.mock.lastCall?.[0];
    expect(!!props?.headIpDisabled).toBe(locked);
    expect(props?.disabled).toBeUndefined();
  });

  it("defaults to SSH with node IPs and auth fields", () => {
    renderCluster();

    screen.getByTestId("node-ips-field-mock");
    screen.getByTestId(SSH_USER);
    expect(screen.queryByTestId(KUBECONFIG)).toBeNull();
    expect(screen.queryByTestId(ACCEL)).toBeNull();
  });

  it("swaps SSH fields for kubeconfig, router and accelerator virtualization on kubernetes, and back", async () => {
    renderCluster();

    switchType("kubernetes");
    await screen.findByTestId(KUBECONFIG);
    screen.getByTestId(
      "field-spec.config.kubernetes_config.router.access_mode",
    );
    screen.getByTestId(ACCEL);
    expect(screen.queryByTestId("node-ips-field-mock")).toBeNull();
    expect(screen.queryByTestId(SSH_USER)).toBeNull();

    switchType("multipleStaticNodes");
    await screen.findByTestId(SSH_USER);
    screen.getByTestId("node-ips-field-mock");
    expect(screen.queryByTestId(KUBECONFIG)).toBeNull();
    expect(screen.queryByTestId(ACCEL)).toBeNull();
  });

  it("seeds router defaults without a version when switching to kubernetes", async () => {
    vi.stubEnv("VITE_DEFAULT_CLUSTER_VERSION", "v1.0.1");
    const { result } = renderCluster();

    switchType("kubernetes");

    await waitFor(() =>
      expect(
        result.current.form.getValues("spec.config.kubernetes_config.router"),
      ).toMatchObject({
        access_mode: "LoadBalancer",
        replicas: 2,
        resources: { cpu: "1", memory: "1Gi" },
      }),
    );
    expect(
      result.current.form.getValues("spec.config.kubernetes_config.router"),
    ).not.toHaveProperty("version");
  });

  it("keeps accelerator virtualization off for kubernetes clusters at or below v1.0.1", async () => {
    const { result } = renderCluster();
    switchType("kubernetes");
    act(() => {
      result.current.form.setValue("spec.version", "v1.0.1");
    });

    const checkbox = (await screen.findByTestId(ACCEL)).querySelector(
      '[role="checkbox"]',
    );
    if (!checkbox) throw new Error("checkbox not found");
    await waitFor(() => expect(checkbox.hasAttribute("disabled")).toBe(true));
    fireEvent.click(checkbox);

    expect(
      result.current.form.getValues("spec.accelerator_virtualization.enabled"),
    ).toBe(false);
    screen.getByText(
      "clusters.descriptions.acceleratorVirtualizationUnsupportedVersion",
    );
  });

  it.each([
    { current: "_all_", workspace: "", error: true },
    { current: "ws-alpha", workspace: "ws-alpha", error: false },
  ])(
    "workspace $current -> defaults to '$workspace', required error: $error",
    async ({ current, workspace, error }) => {
      vi.mocked(useWorkspace).mockReturnValue({ current } as ReturnType<
        typeof useWorkspace
      >);
      const { result } = renderCluster();

      expect(result.current.form.getValues("metadata.workspace")).toBe(
        workspace,
      );
      await act(async () => {
        await result.current.form.trigger("metadata.workspace");
      });
      expect(
        screen.queryByText("common.validation.workspaceRequired") !== null,
      ).toBe(error);
    },
  );

  it.each([false, true])(
    "offers cache configuration only when the server supports it (%s)",
    async (supported) => {
      vi.mocked(useSystemApi).mockReturnValue({
        systemInfo: {
          capabilities: {
            cluster_cache_providers: supported ? ["zcache"] : [],
          },
        },
      } as unknown as ReturnType<typeof useSystemApi>);
      renderCluster();

      switchType("kubernetes");

      await screen.findByTestId(KUBECONFIG);
      expect(screen.queryByText("clusters.cache.title") !== null).toBe(
        supported,
      );
    },
  );
});
