import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { refineForm } from "@/foundation/testing/refine-form";
import { renderForm } from "@/foundation/testing/render-form";
import { useOemConfigForm } from "./use-oem-config-form";

function makeConfig(value: string | null = "saved") {
  return {
    api_version: "v1",
    kind: "OEMConfig",
    metadata: { name: "default" },
    spec: {
      brand_name: value,
      logo_base64: value,
      logo_collapsed_base64: value,
    },
  };
}

function renderConfig(action: "create" | "edit") {
  return renderForm(
    () => useOemConfigForm({ action }),
    (r) => r.formFields,
  );
}

describe("OEM config payloads", () => {
  it("creates the default singleton with the current kind spelling and blank values", async () => {
    const { result } = renderConfig("create");

    await act(() => result.current.form.handleSubmit(refineForm.onFinish)());

    expect(refineForm.onFinish.mock.calls[0][0]).toEqual({
      ...makeConfig(""),
      kind: "OemConfig",
    });
  });

  it.each(["saved", "", null])(
    "reopens %j fields and sends them unchanged",
    async (value) => {
      const record = makeConfig(value);
      const { result } = renderConfig("edit");
      act(() => result.current.form.reset(record));

      expect(
        (
          screen.getByLabelText(
            "oem_configs.fields.brandName",
          ) as HTMLInputElement
        ).value,
      ).toBe(value ?? "");
      await act(() => result.current.form.handleSubmit(refineForm.onFinish)());

      expect(refineForm.onFinish.mock.calls[0][0]).toEqual(record);
    },
  );

  it.each(["  New brand  ", ""])(
    "sends brand %j verbatim while retaining both assets",
    async (brand) => {
      const record = makeConfig();
      const { result } = renderConfig("edit");
      act(() => result.current.form.reset(record));
      fireEvent.change(screen.getByLabelText("oem_configs.fields.brandName"), {
        target: { value: brand },
      });

      await act(() => result.current.form.handleSubmit(refineForm.onFinish)());

      expect(refineForm.onFinish.mock.calls[0][0]).toEqual({
        ...record,
        spec: { ...record.spec, brand_name: brand },
      });
    },
  );

  it.each([
    { field: "logo_base64", input: 0, preview: "Main logo preview" },
    {
      field: "logo_collapsed_base64",
      input: 1,
      preview: "Collapsed logo preview",
    },
  ])(
    "uploads and clears $field without changing its siblings",
    async ({ field, input, preview }) => {
      const record = makeConfig();
      record.spec[field as keyof typeof record.spec] = "";
      const { result, container } = renderConfig("edit");
      act(() => result.current.form.reset(record));
      const fileInput =
        container.querySelectorAll<HTMLInputElement>('input[type="file"]')[
          input
        ];
      fireEvent.change(fileInput, {
        target: {
          files: [new File(["logo"], "logo.png", { type: "image/png" })],
        },
      });

      await waitFor(() =>
        expect(screen.getByAltText(preview).getAttribute("src")).toBe(
          "data:image/png;base64,bG9nbw==",
        ),
      );
      await act(() => result.current.form.handleSubmit(refineForm.onFinish)());
      expect(refineForm.onFinish.mock.calls[0][0]).toEqual({
        ...record,
        spec: { ...record.spec, [field]: "data:image/png;base64,bG9nbw==" },
      });

      fireEvent.change(fileInput, { target: { files: [] } });
      expect(screen.getByAltText(preview).getAttribute("src")).toBe(
        "data:image/png;base64,bG9nbw==",
      );
      fireEvent.click(screen.getAllByRole("button", { name: "" })[input]);
      expect(screen.queryByAltText(preview)).toBeNull();
      await act(() => result.current.form.handleSubmit(refineForm.onFinish)());
      expect(refineForm.onFinish.mock.calls[1][0]).toEqual(record);
    },
  );
});
