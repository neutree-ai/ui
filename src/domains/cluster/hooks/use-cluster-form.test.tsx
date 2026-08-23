import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { FormProvider } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@refinedev/react-hook-form", async () => {
  const rhf =
    await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return {
    useForm: (opts: Record<string, unknown>) => {
      const { refineCoreProps, warnWhenUnsavedChanges, ...rhfOpts } = opts;
      const form = rhf.useForm(rhfOpts);
      (form as Record<string, unknown>).refineCore = {
        onFinish: vi.fn(),
      };
      return form;
    },
  };
});

const { mockUseCustom } = vi.hoisted(() => ({ mockUseCustom: vi.fn() }));
let mockAvailableVersions: string[] = [];

vi.mock("@refinedev/core", () => ({
  useSelect: () => ({
    query: { data: { data: [] }, isLoading: false },
  }),
  useCustom: mockUseCustom,
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

const mockUseWorkspace = vi.fn(() => ({ current: "default" }));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => mockUseWorkspace(),
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

import { useClusterForm } from "./use-cluster-form";

let formInstance: ReturnType<typeof useClusterForm>["form"] | null = null;

function CreateForm() {
  const result = useClusterForm({ action: "create" });
  formInstance = result.form;
  const {
    form,
    clusterConfigurationFields,
    providerFields,
    routerFields,
    acceleratorVirtualizationFields,
    authFields,
  } = result;
  return (
    <FormProvider {...form}>
      <form>
        {clusterConfigurationFields}
        {providerFields}
        {routerFields}
        {acceleratorVirtualizationFields}
        {authFields}
      </form>
    </FormProvider>
  );
}

function ClusterConfigurationForm() {
  const { form, clusterConfigurationFields } = useClusterForm({
    action: "create",
  });
  formInstance = form;
  return (
    <FormProvider {...form}>
      <form>{clusterConfigurationFields}</form>
    </FormProvider>
  );
}

function EditForm() {
  const result = useClusterForm({ action: "edit" });
  formInstance = result.form;
  const {
    form,
    clusterConfigurationFields,
    providerFields,
    routerFields,
    acceleratorVirtualizationFields,
    authFields,
  } = result;
  return (
    <FormProvider {...form}>
      <form>
        {clusterConfigurationFields}
        {providerFields}
        {routerFields}
        {acceleratorVirtualizationFields}
        {authFields}
      </form>
    </FormProvider>
  );
}

function MetadataForm() {
  const { form, metadataFields } = useClusterForm({ action: "create" });
  formInstance = form;
  return (
    <FormProvider {...form}>
      <form data-testid="metadata-form">{metadataFields}</form>
    </FormProvider>
  );
}

function selectType(label: string) {
  const field = screen.getByTestId("field-spec.type");
  const trigger = field.querySelector('button[role="combobox"]');
  if (!trigger) throw new Error("select trigger not found");
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("option", { name: label }));
}

describe("useClusterForm", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    formInstance = null;
    mockAvailableVersions = [];
    mockUseCustom.mockImplementation(() => ({
      data: { data: { available_versions: mockAvailableVersions } },
      isLoading: false,
    }));
    mockUseCustom.mockClear();
  });

  it("groups type, image registry and version under cluster configuration", () => {
    render(<ClusterConfigurationForm />);

    expect(
      screen.getByText("clusters.sections.clusterConfiguration"),
    ).toBeTruthy();
    expect(screen.getByText("common.fields.type")).toBeTruthy();
    expect(screen.getByText("common.fields.imageRegistry")).toBeTruthy();
    expect(screen.getByText("common.fields.version")).toBeTruthy();
  });

  it("does not preselect a version from available_versions", async () => {
    mockAvailableVersions = ["v1.1.0", "v1.2.0"];

    render(<ClusterConfigurationForm />);

    await waitFor(() => {
      expect(formInstance?.getValues("spec.version")).toBeFalsy();
    });
  });

  it("waits for an image registry before querying available versions", async () => {
    render(<ClusterConfigurationForm />);

    expect(mockUseCustom).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: "",
        queryOptions: { enabled: false },
      }),
    );

    act(() => formInstance?.setValue("spec.image_registry", "registry-a"));

    await waitFor(() => {
      expect(mockUseCustom).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: "/clusters/available_versions?workspace=default&image_registry=registry-a&cluster_type=ssh",
          queryOptions: { enabled: true },
        }),
      );
    });
  });

  it("updates the version query when the cluster type changes", async () => {
    render(<CreateForm />);

    act(() => formInstance?.setValue("spec.image_registry", "registry-a"));
    selectType("clusters.options.kubernetes");

    await waitFor(() => {
      expect(mockUseCustom).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: "/clusters/available_versions?workspace=default&image_registry=registry-a&cluster_type=kubernetes",
          queryOptions: { enabled: true },
        }),
      );
    });
  });

  it("clears a selected version when the registry no longer provides it", async () => {
    mockAvailableVersions = ["v1.1.0"];
    render(<ClusterConfigurationForm />);

    act(() => formInstance?.setValue("spec.image_registry", "registry-a"));
    await waitFor(() => {
      expect(formInstance?.getValues("spec.version")).toBeFalsy();
    });

    act(() => {
      formInstance?.setValue("spec.version", "v1.1.0");
    });
    expect(formInstance?.getValues("spec.version")).toBe("v1.1.0");
    mockAvailableVersions = ["v1.2.0"];

    act(() => formInstance?.setValue("spec.image_registry", "registry-b"));

    await waitFor(() => {
      expect(formInstance?.getValues("spec.version")).toBeFalsy();
    });
  });

  it("clears a selected version when the cluster type changes", async () => {
    mockAvailableVersions = ["v1.1.0"];
    render(<CreateForm />);

    act(() => formInstance?.setValue("spec.image_registry", "registry-a"));
    act(() => formInstance?.setValue("spec.version", "v1.1.0"));
    expect(formInstance?.getValues("spec.version")).toBe("v1.1.0");

    selectType("clusters.options.kubernetes");

    await waitFor(() => {
      expect(formInstance?.getValues("spec.version")).toBeFalsy();
    });
  });

  it("clears a selected version when the current source refreshes without it", async () => {
    mockAvailableVersions = ["v1.1.0"];
    const view = render(<ClusterConfigurationForm />);

    act(() => formInstance?.setValue("spec.image_registry", "registry-a"));
    act(() => formInstance?.setValue("spec.version", "v1.1.0"));
    expect(formInstance?.getValues("spec.version")).toBe("v1.1.0");

    mockAvailableVersions = [];
    view.rerender(<ClusterConfigurationForm />);

    await waitFor(() => {
      expect(formInstance?.getValues("spec.version")).toBeFalsy();
    });
  });

  it("does not query versions while workspace is not routable", () => {
    mockUseWorkspace.mockReturnValue({ current: "_all_" });
    render(<ClusterConfigurationForm />);

    expect(mockUseCustom).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: "",
        queryOptions: { enabled: false },
      }),
    );
  });

  describe("edit mode — NodeIPsField props", () => {
    it("passes headIpDisabled=true without disabled in edit mode", () => {
      nodeIPsFieldProps.mockClear();
      render(<EditForm />);
      const lastCall =
        nodeIPsFieldProps.mock.calls[
          nodeIPsFieldProps.mock.calls.length - 1
        ][0];
      expect(lastCall.headIpDisabled).toBe(true);
      expect(lastCall.disabled).toBeUndefined();
    });

    it("does not pass headIpDisabled=true in create mode", () => {
      nodeIPsFieldProps.mockClear();
      render(<CreateForm />);
      const lastCall =
        nodeIPsFieldProps.mock.calls[
          nodeIPsFieldProps.mock.calls.length - 1
        ][0];
      expect(lastCall.headIpDisabled).toBeFalsy();
      expect(lastCall.disabled).toBeUndefined();
    });
  });

  describe("type switching", () => {
    it("defaults to SSH with auth fields and no router fields", () => {
      render(<CreateForm />);

      expect(screen.getByTestId("node-ips-field-mock")).toBeTruthy();
      expect(
        screen.getByTestId("field-spec.config.ssh_config.auth.ssh_user"),
      ).toBeTruthy();
      expect(
        screen.queryByTestId("field-spec.config.kubernetes_config.kubeconfig"),
      ).toBeNull();
    });

    it("shows router and kubeconfig fields when switching to kubernetes", async () => {
      render(<CreateForm />);

      selectType("clusters.options.kubernetes");

      await waitFor(() => {
        expect(
          screen.getByTestId("field-spec.config.kubernetes_config.kubeconfig"),
        ).toBeTruthy();
        expect(
          screen.getByTestId(
            "field-spec.config.kubernetes_config.router.access_mode",
          ),
        ).toBeTruthy();
      });

      expect(screen.queryByTestId("node-ips-field-mock")).toBeNull();
      expect(
        screen.queryByTestId("field-spec.config.ssh_config.auth.ssh_user"),
      ).toBeNull();
    });

    it("does not seed router version when switching to kubernetes", async () => {
      render(<CreateForm />);

      selectType("clusters.options.kubernetes");

      await waitFor(() => {
        expect(
          formInstance?.getValues(
            "spec.config.kubernetes_config.router.access_mode",
          ),
        ).toBe("LoadBalancer");
      });

      const router = formInstance?.getValues(
        "spec.config.kubernetes_config.router",
      );
      expect(router).toMatchObject({
        access_mode: "LoadBalancer",
        replicas: 2,
        resources: { cpu: "1", memory: "1Gi" },
      });
      expect(router).not.toHaveProperty("version");
    });

    it("shows accelerator virtualization only for kubernetes clusters", async () => {
      render(<CreateForm />);

      expect(
        screen.queryByTestId("field-spec.accelerator_virtualization.enabled"),
      ).toBeNull();

      selectType("clusters.options.kubernetes");

      await waitFor(() => {
        expect(
          screen.getByTestId("field-spec.accelerator_virtualization.enabled"),
        ).toBeTruthy();
      });

      selectType("clusters.options.multipleStaticNodes");

      await waitFor(() => {
        expect(
          screen.queryByTestId("field-spec.accelerator_virtualization.enabled"),
        ).toBeNull();
      });
    });

    it("disables accelerator virtualization for kubernetes clusters at or below v1.0.1", async () => {
      render(<CreateForm />);

      selectType("clusters.options.kubernetes");

      await waitFor(() => expect(formInstance).not.toBeNull());
      act(() => {
        formInstance?.setValue("spec.version", "v1.0.1");
      });

      const field = await screen.findByTestId(
        "field-spec.accelerator_virtualization.enabled",
      );
      const checkbox = field.querySelector('[role="checkbox"]');
      if (!checkbox)
        throw new Error("accelerator virtualization checkbox not found");

      await waitFor(() => expect(checkbox.hasAttribute("disabled")).toBe(true));
      fireEvent.click(checkbox);

      expect(
        formInstance?.getValues("spec.accelerator_virtualization.enabled"),
      ).toBe(false);
      expect(
        screen.getByText(
          "clusters.descriptions.acceleratorVirtualizationUnsupportedVersion",
        ),
      ).toBeTruthy();
    });

    it("restores SSH fields when switching back from kubernetes", async () => {
      render(<CreateForm />);

      selectType("clusters.options.kubernetes");

      await waitFor(() => {
        expect(
          screen.getByTestId("field-spec.config.kubernetes_config.kubeconfig"),
        ).toBeTruthy();
      });

      selectType("clusters.options.multipleStaticNodes");

      await waitFor(() => {
        expect(screen.getByTestId("node-ips-field-mock")).toBeTruthy();
        expect(
          screen.getByTestId("field-spec.config.ssh_config.auth.ssh_user"),
        ).toBeTruthy();
      });

      expect(
        screen.queryByTestId("field-spec.config.kubernetes_config.kubeconfig"),
      ).toBeNull();
    });
  });

  describe("workspace validation", () => {
    beforeEach(() => {
      mockUseWorkspace.mockReset();
    });

    it("defaults to empty string when current workspace is _all_", () => {
      mockUseWorkspace.mockReturnValue({ current: "_all_" });

      render(<MetadataForm />);
      const field = screen.getByTestId("field-metadata.workspace");

      expect(field).toBeTruthy();
    });

    it("shows validation error on submit when workspace is _all_", async () => {
      mockUseWorkspace.mockReturnValue({ current: "_all_" });

      render(<MetadataForm />);

      await act(async () => {
        await formInstance!.trigger("metadata.workspace");
      });

      await waitFor(() => {
        expect(
          screen.getByText("common.validation.workspaceRequired"),
        ).toBeTruthy();
      });
    });

    it("does not show validation error when workspace is valid", async () => {
      mockUseWorkspace.mockReturnValue({ current: "ws-alpha" });

      render(<MetadataForm />);

      await act(async () => {
        await formInstance!.trigger("metadata.workspace");
      });

      expect(
        screen.queryByText("common.validation.workspaceRequired"),
      ).toBeNull();
    });
  });
});
