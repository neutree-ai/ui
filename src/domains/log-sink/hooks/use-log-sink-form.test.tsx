import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

  it("create s3: only s3 fields count, keys are required, Save and Test agree", async () => {
    const { result, submit } = renderLogSinkForm("create");
    selectOption("spec.type", "log_sinks.types.s3");
    expect(screen.queryByTestId("field-spec.victorialogs.url")).toBeNull();
    fillField("metadata.name", "archive");
    fillField("spec.s3.region", "us-east-1");
    fillField("spec.s3.bucket", "traces");

    await act(() => result.current.form.trigger());
    screen.getByText("log_sinks.validation.accessKeyIdRequired");
    screen.getByText("log_sinks.validation.secretAccessKeyRequired");

    fillField("spec.s3.auth.access_key_id", "ak");
    fillField("spec.s3.auth.secret_access_key", "sk");
    // The hidden VictoriaLogs URL, left empty, does not block an s3 sink.
    expect(await act(() => result.current.form.trigger())).toBe(true);

    const { saved, tested } = await submitAndTest(submit);
    expect(saved.spec).toMatchObject({ type: "s3", s3: { bucket: "traces" } });
    expect(saved.spec).not.toHaveProperty("victorialogs");
    expect(tested).toEqual({ spec: saved.spec });
  });

  it("edit s3: type locked, blank keys are valid and stay out of both", async () => {
    const stored = emptyLogSinkFormValues();
    stored.metadata.name = "archive";
    stored.spec.type = "s3";
    stored.spec.s3.region = "us-east-1";
    stored.spec.s3.bucket = "traces";
    refineForm.queryData = { ...stored, id: 9 };
    const { result, submit } = renderLogSinkForm("edit");
    act(() => result.current.form.reset(stored));
    expect(
      (
        within(screen.getByTestId("field-spec.type")).getByRole(
          "combobox",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    expect(await act(() => result.current.form.trigger())).toBe(true);

    const { saved, tested } = await submitAndTest(submit);
    expect(saved.spec.s3).not.toHaveProperty("auth");
    expect(tested).toEqual({ id: 9, spec: saved.spec });
  });
});
