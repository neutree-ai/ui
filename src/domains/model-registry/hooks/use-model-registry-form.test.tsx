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
  isValidWorkspace: (v: string | undefined | null) => !!v && v !== "_all_",
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

function urlPlaceholder() {
  const field = screen.getByTestId("field-spec.url");
  return field.querySelector("input")?.getAttribute("placeholder");
}

function selectedType() {
  const field = screen.getByTestId("field-spec.type");
  return field.querySelector('button[role="combobox"]')?.textContent;
}

describe("useModelRegistryForm", () => {
  describe("URL protocol validation", () => {
    it("shows error for non-NFS URL when bentoml type is selected", async () => {
      render(<CreateForm />);

      // Away and back, so this still proves the rule follows the selection.
      // The form now opens on this kind, and selecting it directly would pass
      // even if choosing a type did nothing at all.
      selectType("model_registries.types.huggingFace");
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

      // Selected rather than relied on: the form no longer opens on this kind.
      selectType("model_registries.types.huggingFace");
      await fillUrl("https://huggingface.co");

      await waitFor(() => {
        expect(
          screen.queryByText("model_registries.validation.mustUseNfsProtocol"),
        ).toBeNull();
      });
    });

    it("does not validate URL protocol for model-scope type", async () => {
      render(<CreateForm />);

      selectType("model_registries.types.modelScope");
      await fillUrl("https://www.modelscope.cn");

      await waitFor(() => {
        expect(
          screen.queryByText("model_registries.validation.mustUseNfsProtocol"),
        ).toBeNull();
      });
    });
  });

  describe("registry type", () => {
    it("offers ModelScope", () => {
      render(<CreateForm />);

      const field = screen.getByTestId("field-spec.type");
      const trigger = field.querySelector('button[role="combobox"]');
      if (!trigger) throw new Error("select trigger not found");
      fireEvent.click(trigger);

      expect(
        screen.getByRole("option", {
          name: "model_registries.types.modelScope",
        }),
      ).toBeTruthy();
    });

    it("starts on the file system kind", () => {
      // The kind a new registry can actually be pushed to. The public hubs are
      // provisioned rather than made by hand, and refuse writes.
      render(<CreateForm />);

      expect(selectedType()).toBe("model_registries.types.fileSystem");
    });

    it("applies the file system URL rule from the first render", async () => {
      // Follows from the default, and is the half that bites: the rule is in
      // force before the user has touched the type field at all.
      render(<CreateForm />);

      await fillUrl("https://example.com");

      await waitFor(() => {
        expect(
          screen.getByText("model_registries.validation.mustUseNfsProtocol"),
        ).toBeTruthy();
      });
    });

    it("shows the example address of the kind that is selected", async () => {
      render(<CreateForm />);

      expect(urlPlaceholder()).toBe(
        "model_registries.placeholders.fileSystemUrl",
      );

      selectType("model_registries.types.modelScope");
      await waitFor(() => {
        expect(urlPlaceholder()).toBe(
          "model_registries.placeholders.modelScopeUrl",
        );
      });

      selectType("model_registries.types.huggingFace");
      await waitFor(() => {
        expect(urlPlaceholder()).toBe(
          "model_registries.placeholders.huggingFaceUrl",
        );
      });
    });

    it("asks for credentials whatever the kind is", async () => {
      // Every kind can carry one — a hub token, or a credential for the mount —
      // so the field is not conditional and switching kind never hides a value
      // already typed.
      render(<CreateForm />);

      expect(screen.getByTestId("field-spec.credentials")).toBeTruthy();

      selectType("model_registries.types.modelScope");
      await waitFor(() => {
        expect(screen.getByTestId("field-spec.credentials")).toBeTruthy();
      });
    });
  });
});
