import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { FormProvider } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
}));

import { useModelRegistryForm } from "./use-model-registry-form";

function CreateForm() {
  const { form, specFields } = useModelRegistryForm({ action: "create" });
  return (
    <FormProvider {...form}>
      <form>{specFields}</form>
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

async function fillUrl(value: string) {
  const field = screen.getByTestId("field-spec.url");
  const input = field.querySelector("input");
  if (!input) throw new Error("url input not found");
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("useModelRegistryForm", () => {
  describe("URL protocol validation", () => {
    it("shows error for non-NFS URL when bentoml type is selected", async () => {
      render(<CreateForm />);

      selectType("model_registries.types.fileSystem");
      await fillUrl("https://example.com");

      await waitFor(() => {
        expect(
          screen.getByText("model_registries.validation.mustUseNfsProtocol"),
        ).toBeTruthy();
      });
    });

    it("passes validation for NFS URL when bentoml type is selected", async () => {
      render(<CreateForm />);

      selectType("model_registries.types.fileSystem");
      await fillUrl("nfs://server/path");

      await waitFor(() => {
        expect(
          screen.queryByText("model_registries.validation.mustUseNfsProtocol"),
        ).toBeNull();
      });
    });

    it("does not validate URL protocol for hugging-face type", async () => {
      render(<CreateForm />);

      await fillUrl("https://huggingface.co");

      await waitFor(() => {
        expect(
          screen.queryByText("model_registries.validation.mustUseNfsProtocol"),
        ).toBeNull();
      });
    });
  });
});
