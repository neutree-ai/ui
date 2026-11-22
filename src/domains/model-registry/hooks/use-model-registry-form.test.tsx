import { act, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fillField, selectOption } from "@/foundation/testing/interactions";
import { refineForm } from "@/foundation/testing/refine-form";
import { renderForm } from "@/foundation/testing/render-form";
import { useModelRegistryForm } from "./use-model-registry-form";

vi.mock("@/foundation/role/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
  isValidWorkspace: (v: string | undefined | null) => !!v && v !== "_all_",
}));

type FormHook = ReturnType<typeof useModelRegistryForm>;

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

  it("rejects a file:// address on a file system registry", async () => {
    renderCreate();
    fillField("spec.url", "file://localhost/models");

    await screen.findByText(NFS_ERROR);
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

  describe("submit payloads", () => {
    // The API never returns spec.credentials: it is a masked field.
    const storedRecord = {
      id: 7,
      api_version: "v1",
      kind: "ModelRegistry",
      metadata: { name: "reg", workspace: "default" },
      spec: { type: "hugging-face", url: "https://huggingface.co" },
      status: { phase: "Connected" },
    };

    const renderEdit = () => {
      const rendered = renderForm(
        () => useModelRegistryForm({ action: "edit" }),
        (r) => r.specFields,
      );
      act(() => rendered.result.current.form.reset(storedRecord));
      return rendered;
    };

    const submit = async ({ result }: { result: { current: FormHook } }) => {
      const { form } = result.current;
      await act(() => form.handleSubmit(form.refineCore.onFinish)());
      await waitFor(() => expect(refineForm.onFinish).toHaveBeenCalled());
      return JSON.parse(JSON.stringify(refineForm.onFinish.mock.calls[0][0]));
    };

    it("submits what was typed on create, empty credentials included", async () => {
      const rendered = renderCreate();
      selectOption("spec.type", "model_registries.types.huggingFace");
      fillField("spec.url", "https://huggingface.co");
      act(() => {
        rendered.result.current.form.setValue("metadata.name", "reg");
        rendered.result.current.form.setValue("metadata.workspace", "default");
      });

      expect(await submit(rendered)).toEqual({
        api_version: "v1",
        kind: "ModelRegistry",
        metadata: { name: "reg", workspace: "default" },
        spec: {
          type: "hugging-face",
          url: "https://huggingface.co",
          credentials: "",
        },
      });
    });

    it("sends an untouched edit without credentials, leaving them to the server", async () => {
      expect(await submit(renderEdit())).toEqual(storedRecord);
    });

    it("sends a changed url and keeps credentials out of the payload", async () => {
      const rendered = renderEdit();
      fillField("spec.url", "https://mirror.example.com");

      const payload = await submit(rendered);

      expect(payload.spec).toEqual({
        type: "hugging-face",
        url: "https://mirror.example.com",
      });
    });

    it("sends typed credentials", async () => {
      const rendered = renderEdit();
      fillField("spec.credentials", "hf_token");

      expect((await submit(rendered)).spec.credentials).toBe("hf_token");
    });

    it("sends credentials that were typed into and then emptied", async () => {
      const rendered = renderEdit();
      fillField("spec.credentials", "hf_token");
      fillField("spec.credentials", "");

      expect((await submit(rendered)).spec.credentials).toBe("");
    });

    it("sends a changed type", async () => {
      const rendered = renderEdit();
      selectOption("spec.type", "model_registries.types.modelScope");

      expect((await submit(rendered)).spec.type).toBe("model-scope");
    });
  });
});
