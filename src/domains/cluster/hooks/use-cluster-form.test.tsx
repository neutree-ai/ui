import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectOption } from "@/foundation/testing/interactions";
import { refineForm } from "@/foundation/testing/refine-form";
import { renderForm } from "@/foundation/testing/render-form";

const registry = vi.hoisted(() => ({ versions: [] as string[] }));

vi.mock("@refinedev/core", () => ({
  useList: () => ({ data: { data: [] }, isLoading: false }),
  useSelect: () => ({
    query: { data: { data: [] }, isLoading: false },
  }),
  useCustom: () => ({
    data: { data: { available_versions: registry.versions } },
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
      </>
    ),
  );

const switchType = (type: "kubernetes" | "multipleStaticNodes") =>
  selectOption("spec.type", `clusters.options.${type}`);

describe("useClusterForm", () => {
  beforeEach(() => {
    registry.versions = [];
    vi.unstubAllEnvs();
    vi.mocked(useWorkspace).mockReset();
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

  it("keeps KV Cache configuration out of the cluster form", async () => {
    renderCluster();

    switchType("kubernetes");

    await screen.findByTestId(KUBECONFIG);
    expect(screen.queryByText("clusters.cache.title")).toBeNull();
  });

  describe("submit payload", () => {
    const record = (spec: object) => ({
      id: 3,
      api_version: "v1",
      kind: "Cluster",
      metadata: { name: "c1", workspace: "default" },
      spec: { image_registry: "reg", version: "v1.1.0", ...spec },
      status: { phase: "Running" },
    });
    // The API masks spec.config.ssh_config.auth.ssh_private_key and
    // spec.config.kubernetes_config.kubeconfig. Keys the form has no field
    // for (metrics, router proxy options) must survive the round trip.
    const storedSsh = record({
      type: "ssh",
      config: {
        ssh_config: {
          provider: { head_ip: "10.0.0.1", worker_ips: ["10.0.0.2"] },
          auth: { ssh_user: "root" },
        },
        metrics: { accelerator_exporter: { mode: "external" } },
        model_caches: [],
      },
    });
    const storedK8s = record({
      type: "kubernetes",
      config: {
        kubernetes_config: {
          router: {
            access_mode: "NodePort",
            replicas: 2,
            resources: { cpu: "1", memory: "1Gi" },
            max_connections_per_backend: 10,
          },
        },
        model_caches: [],
      },
    });

    const renderEdit = (stored: object) => {
      const rendered = renderCluster("edit");
      act(() => rendered.result.current.form.reset(stored));
      return rendered;
    };

    const submit = async ({ result }: ReturnType<typeof renderCluster>) => {
      const { form } = result.current;
      await act(() => form.handleSubmit(form.refineCore.onFinish)());
      await waitFor(() => expect(refineForm.onFinish).toHaveBeenCalled());
      return JSON.parse(JSON.stringify(refineForm.onFinish.mock.calls[0][0]));
    };

    it.each([
      { kind: "ssh", stored: storedSsh, sent: storedSsh },
      {
        kind: "kubernetes",
        stored: storedK8s,
        sent: {
          ...storedK8s,
          spec: { ...storedK8s.spec, accelerator_virtualization: {} },
        },
      },
    ])(
      "sends an untouched $kind edit without secrets, leaving them to the server",
      async ({ stored, sent }) => {
        expect(await submit(renderEdit(stored))).toEqual(sent);
      },
    );

    it("encodes a kubeconfig typed on edit", async () => {
      const rendered = renderEdit(storedK8s);
      const kubeconfig = screen.getByLabelText("clusters.fields.kubeconfig");
      fireEvent.change(kubeconfig, { target: { value: "apiVersion: v1" } });
      fireEvent.blur(kubeconfig);

      const payload = await submit(rendered);

      expect(payload.spec.config.kubernetes_config.kubeconfig).toBe(
        btoa("apiVersion: v1"),
      );
    });

    it("sends a kubeconfig typed into and then emptied as an empty string", async () => {
      const rendered = renderEdit(storedK8s);
      const kubeconfig = screen.getByLabelText("clusters.fields.kubeconfig");
      fireEvent.change(kubeconfig, { target: { value: "x" } });
      fireEvent.change(kubeconfig, { target: { value: "" } });
      fireEvent.blur(kubeconfig);

      const payload = await submit(rendered);

      expect(payload.spec.config.kubernetes_config.kubeconfig).toBe("");
    });

    it("encodes an SSH key typed on create with a trailing newline", async () => {
      registry.versions = ["v1.1.0"];
      const rendered = renderCluster("create");
      act(() => {
        rendered.result.current.form.setValue("metadata.name", "c1");
        rendered.result.current.form.setValue("spec.image_registry", "reg");
      });
      fireEvent.change(screen.getByLabelText("clusters.fields.sshPrivateKey"), {
        target: { value: "key-content" },
      });

      const payload = await submit(rendered);

      expect(payload.spec.config.ssh_config.auth.ssh_private_key).toBe(
        btoa("key-content\n"),
      );
    });
  });
});
