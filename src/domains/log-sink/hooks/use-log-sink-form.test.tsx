import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLogSinkFormValues } from "@/domains/log-sink/testing/builders";
import { fillField, selectOption } from "@/foundation/testing/interactions";
import { refineForm } from "@/foundation/testing/refine-form";
import { renderForm } from "@/foundation/testing/render-form";
import { useLogSinkForm } from "./use-log-sink-form";

const mutateAsync = vi.hoisted(() =>
  vi.fn(async (_: unknown) => ({ data: { ok: true } })),
);

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync }),
}));

function renderLogSinkForm(action: "create" | "edit") {
  const rendered = renderForm(
    () => useLogSinkForm({ action }),
    (r) => (
      <>
        {r.metadataFields}
        {r.specFields}
      </>
    ),
  );
  const submit = () =>
    act(() =>
      rendered.result.current.form.refineCore.onFinish(
        rendered.result.current.form.getValues(),
      ),
    );
  return { ...rendered, submit };
}

beforeEach(() => {
  mutateAsync.mockClear();
});

describe("useLogSinkForm", () => {
  it("create: Save sends the whole object", async () => {
    const { submit } = renderLogSinkForm("create");
    fillField("metadata.name", "vl");
    fillField("spec.victorialogs.url", "https://vl:9428");
    selectOption("spec.victorialogs.auth.type", "log_sinks.authTypes.bearer");
    fillField("spec.victorialogs.auth.token", "secret");

    await submit();

    expect(refineForm.onFinish.mock.calls[0][0]).toMatchObject({
      api_version: "v1",
      kind: "LogSink",
      metadata: { name: "vl" },
      spec: { victorialogs: { auth: { type: "bearer", token: "secret" } } },
    });
  });

  it("edit: name locked, Save sends only the spec, Test Connection the same spec with the id", async () => {
    const stored = makeLogSinkFormValues();
    refineForm.queryData = { ...stored, id: 7 };
    const { result, submit } = renderLogSinkForm("edit");
    act(() => result.current.form.reset(stored));
    expect(
      (screen.getByLabelText(/^common\.fields\.name/) as HTMLInputElement)
        .disabled,
    ).toBe(true);

    await submit();
    fireEvent.click(screen.getByTestId("log-sink-test-connection"));

    const saved = refineForm.onFinish.mock.calls[0][0];
    expect(Object.keys(saved)).toEqual(["spec"]);
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ values: { id: 7, spec: saved.spec } }),
      ),
    );
    await screen.findByTestId("log-sink-test-result");
  });
});
