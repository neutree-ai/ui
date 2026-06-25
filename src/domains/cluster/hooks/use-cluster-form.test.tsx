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

vi.mock("@refinedev/core", () => ({
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
    typeFields,
    providerFields,
    routerFields,
    acceleratorVirtualizationFields,
    authFields,
  } = result;
  return (
    <FormProvider {...form}>
      <form>
        {typeFields}
        {providerFields}
        {routerFields}
        {acceleratorVirtualizationFields}
        {authFields}
      </form>
    </FormProvider>
  );
}

function VersionFieldsForm() {
  const { form, versionFields } = useClusterForm({ action: "create" });
  return (
    <FormProvider {...form}>
      <form>{versionFields}</form>
    </FormProvider>
  );
}

function EditForm() {
  const result = useClusterForm({ action: "edit" });
  formInstance = result.form;
  const {
    form,
    typeFields,
    providerFields,
    routerFields,
    acceleratorVirtualizationFields,
    authFields,
  } = result;
  return (
    <FormProvider {...form}>
      <form>
        {typeFields}
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
    formInstance = null;
  });

  it("labels the version section as cluster version", () => {
    render(<VersionFieldsForm />);

    expect(screen.getByText("clusters.sections.clusterVersion")).toBeTruthy();
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

    it("disables accelerator virtualization for kubernetes clusters below v1.1.0", async () => {
      render(<CreateForm />);

      selectType("clusters.options.kubernetes");

      await waitFor(() => expect(formInstance).not.toBeNull());
      act(() => {
        formInstance?.setValue("spec.version", "v1.0.9");
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
