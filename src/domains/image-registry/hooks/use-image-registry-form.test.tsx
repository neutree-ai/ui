import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { refineForm } from "@/foundation/testing/refine-form";
import { renderForm } from "@/foundation/testing/render-form";
import { useImageRegistryForm } from "./use-image-registry-form";

vi.mock("@/foundation/hooks/use-workspace", async (importActual) => ({
  ...(await importActual<object>()),
  useWorkspace: () => ({ current: "default" }),
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: () => <div />,
}));

// The API never returns spec.authconfig: it is a masked field.
const storedRecord = {
  id: 7,
  api_version: "v1",
  kind: "ImageRegistry",
  metadata: { name: "reg", workspace: "default" },
  spec: { url: "https://registry.example.com", repository: "team" },
  status: { phase: "Connected" },
};

const renderRegistryForm = (action: "create" | "edit") =>
  renderForm(
    () => useImageRegistryForm({ action }),
    (r) => (
      <>
        {r.metadataFields}
        {r.specFields}
      </>
    ),
  );

const renderEdit = () => {
  const rendered = renderRegistryForm("edit");
  act(() => rendered.result.current.form.reset(storedRecord));
  return rendered;
};

const submit = async ({ result }: ReturnType<typeof renderRegistryForm>) => {
  const { form } = result.current;
  await act(() => form.handleSubmit(form.refineCore.onFinish)());
  await waitFor(() => expect(refineForm.onFinish).toHaveBeenCalled());
  return JSON.parse(JSON.stringify(refineForm.onFinish.mock.calls[0][0]));
};

const username = () =>
  screen.getByLabelText("image_registries.fields.username");

describe("useImageRegistryForm", () => {
  it("submits what was typed on create, empty credentials included", async () => {
    const rendered = renderRegistryForm("create");
    fireEvent.change(screen.getByLabelText(/^common\.fields\.name/), {
      target: { value: "reg" },
    });
    fireEvent.change(screen.getByLabelText(/^image_registries\.fields\.url/), {
      target: { value: "https://registry.example.com" },
    });
    act(() =>
      rendered.result.current.form.setValue("metadata.workspace", "default"),
    );

    const payload = await submit(rendered);

    expect(payload).toMatchObject({
      metadata: { name: "reg", workspace: "default" },
      spec: {
        url: "https://registry.example.com",
        repository: "",
        authconfig: { username: "", password: "" },
      },
    });
  });

  it("locks name on edit", () => {
    renderEdit();
    expect(
      screen.getByLabelText<HTMLInputElement>(/^common\.fields\.name/).disabled,
    ).toBe(true);
  });

  it("sends an untouched edit without credentials, leaving them to the server", async () => {
    const payload = await submit(renderEdit());

    expect(payload).toEqual(storedRecord);
  });

  it("sends the username alone when only it is filled", async () => {
    const rendered = renderEdit();
    fireEvent.change(username(), { target: { value: "bob" } });

    const payload = await submit(rendered);

    expect(payload.spec.authconfig).toEqual({ username: "bob" });
  });

  it("sends a credential field the user typed into and then emptied", async () => {
    const rendered = renderEdit();
    fireEvent.change(username(), { target: { value: "bob" } });
    fireEvent.change(username(), { target: { value: "" } });
    fireEvent.blur(username());

    const payload = await submit(rendered);

    expect(payload.spec.authconfig).toEqual({ username: "" });
  });
});
