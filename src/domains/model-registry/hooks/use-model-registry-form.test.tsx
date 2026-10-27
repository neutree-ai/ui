import { act, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { fillField, selectOption } from "@/foundation/testing/interactions";
import { refineForm } from "@/foundation/testing/refine-form";
import { renderForm } from "@/foundation/testing/render-form";
import { useModelRegistryForm } from "./use-model-registry-form";

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
  isValidWorkspace: (v: string | undefined | null) => !!v && v !== "_all_",
}));

const renderCreate = () =>
  renderForm(
    () => useModelRegistryForm({ action: "create" }),
    (r) => r.specFields,
  );

const NFS_ERROR = "model_registries.validation.mustUseNfsProtocol";

const urlInput = () =>
  within(screen.getByTestId("field-spec.url")).getByRole("textbox");

describe("useModelRegistryForm", () => {
  it("opens on the file system kind with its nfs:// rule already in force", async () => {
    // The kind a new registry can actually be pushed to; the public hubs are
    // provisioned rather than made by hand.
    const { result } = renderCreate();

    expect(result.current.form.getValues("spec.type")).toBe("bentoml");
    fillField("spec.url", "https://example.com");

    await screen.findByText(NFS_ERROR);
  });

  it.each([
    ["model_registries.types.fileSystem", "nfs://server/path"],
    ["model_registries.types.huggingFace", "https://huggingface.co"],
    ["model_registries.types.modelScope", "https://www.modelscope.cn"],
  ])("accepts %s with url %s", async (type, url) => {
    const { result } = renderCreate();
    selectOption("spec.type", "model_registries.types.huggingFace");
    selectOption("spec.type", type);
    fillField("spec.url", url);

    expect(await act(() => result.current.form.trigger("spec.url"))).toBe(true);
    expect(screen.queryByText(NFS_ERROR)).toBeNull();
  });

  it("re-applies the nfs:// rule when switching back to file system", async () => {
    renderCreate();
    selectOption("spec.type", "model_registries.types.huggingFace");
    selectOption("spec.type", "model_registries.types.fileSystem");

    fillField("spec.url", "https://example.com");

    await screen.findByText(NFS_ERROR);
  });

  it("shows the example address of the selected kind", async () => {
    renderCreate();

    selectOption("spec.type", "model_registries.types.modelScope");

    await waitFor(() =>
      expect(urlInput().getAttribute("placeholder")).toBe(
        "model_registries.placeholders.modelScopeUrl",
      ),
    );
  });

  it("keeps typed credentials when the kind changes", async () => {
    // Every kind can carry one: a hub token, or a credential for the mount.
    const { result } = renderCreate();
    fillField("spec.credentials", "secret");

    selectOption("spec.type", "model_registries.types.modelScope");

    await waitFor(() =>
      expect(result.current.form.getValues("spec.credentials")).toBe("secret"),
    );
    screen.getByTestId("field-spec.credentials");
  });

  it("drops untouched empty credentials from an edit submit", async () => {
    const { result } = renderForm(
      () => useModelRegistryForm({ action: "edit" }),
      (r) => r.specFields,
    );

    await act(() =>
      result.current.form.refineCore.onFinish({
        spec: {
          type: "hugging-face",
          url: "https://huggingface.co",
          credentials: "",
        },
      } as ModelRegistry),
    );

    expect(refineForm.onFinish.mock.calls[0][0].spec).not.toHaveProperty(
      "credentials",
    );
  });
});
