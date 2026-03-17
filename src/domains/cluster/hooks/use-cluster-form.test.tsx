import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { FormProvider } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

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
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
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

function CreateForm() {
  const { form, typeFields, providerFields, routerFields, authFields } =
    useClusterForm({ action: "create" });
  return (
    <FormProvider {...form}>
      <form>
        {typeFields}
        {providerFields}
        {routerFields}
        {authFields}
      </form>
    </FormProvider>
  );
}

function EditForm() {
  const { form, typeFields, providerFields, routerFields, authFields } =
    useClusterForm({ action: "edit" });
  return (
    <FormProvider {...form}>
      <form>
        {typeFields}
        {providerFields}
        {routerFields}
        {authFields}
      </form>
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
});
