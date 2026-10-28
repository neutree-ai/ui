import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyLogSinkFormValues } from "@/domains/log-sink/lib/log-sink-form";
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

/** What Save sent and what Test Connection sent, after both were pressed. */
async function submitAndTest(submit: () => Promise<unknown>) {
  await submit();
  fireEvent.click(screen.getByTestId("log-sink-test-connection"));
  await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
  return {
    saved: refineForm.onFinish.mock.calls[0][0],
    tested: (
      mutateAsync.mock.calls[0][0] as { values: Record<string, unknown> }
    ).values,
  };
}

beforeEach(() => {
  mutateAsync.mockClear();
});

describe("useLogSinkForm", () => {
  it("create: Save sends the whole object and Test Connection the same spec", async () => {
    const { submit } = renderLogSinkForm("create");
    fillField("metadata.name", "vl");
    fillField("spec.victorialogs.url", "https://vl:9428");
    selectOption("spec.victorialogs.auth.type", "log_sinks.authTypes.bearer");
    fillField("spec.victorialogs.auth.token", "secret");

    const { saved, tested } = await submitAndTest(submit);

    expect(saved).toMatchObject({
      api_version: "v1",
      kind: "LogSink",
      metadata: { name: "vl" },
      spec: { victorialogs: { auth: { type: "bearer", token: "secret" } } },
    });
    expect(tested).toEqual({ spec: saved.spec });
  });

  it("edit: Save sends only the spec, and a blank secret stays out of both", async () => {
    const stored = emptyLogSinkFormValues();
    stored.metadata.name = "vl";
    stored.spec.victorialogs.url = "https://vl:9428";
    stored.spec.victorialogs.auth.type = "basic";
    stored.spec.victorialogs.auth.username = "u";
    refineForm.queryData = { ...stored, id: 7 };
    const { result, submit } = renderLogSinkForm("edit");
    act(() => result.current.form.reset(stored));
    expect(
      (screen.getByLabelText(/^common\.fields\.name/) as HTMLInputElement)
        .disabled,
    ).toBe(true);

    const { saved, tested } = await submitAndTest(submit);

    expect(Object.keys(saved)).toEqual(["spec"]);
    expect(saved.spec.victorialogs.auth).toEqual({
      type: "basic",
      username: "u",
    });
    expect(tested).toEqual({ id: 7, spec: saved.spec });
    await screen.findByTestId("log-sink-test-result");
  });
});
