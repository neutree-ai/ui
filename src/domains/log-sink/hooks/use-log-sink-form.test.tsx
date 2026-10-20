import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProvider } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LogSinkFormValues } from "@/domains/log-sink/lib/log-sink-form";

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mocks = vi.hoisted(() => ({
  onFinish: vi.fn(async (values: unknown) => values),
  mutateAsync: vi.fn(async (_: unknown) => ({ data: { ok: true } })),
  queryData: undefined as unknown,
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync: mocks.mutateAsync }),
}));

// Refine's useForm, reduced to react-hook-form plus the refineCore parts the
// hook uses. Stored data becomes the defaults, as Refine's population would.
vi.mock("@refinedev/react-hook-form", async () => {
  const rhf =
    await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return {
    useForm: (opts: Record<string, unknown>) => {
      const {
        refineCoreProps: _refineCoreProps,
        warnWhenUnsavedChanges: _warn,
        defaultValues,
        ...rhfOpts
      } = opts;
      const form = rhf.useForm({
        ...rhfOpts,
        defaultValues: (mocks.queryData as object) ?? defaultValues,
      });
      return {
        ...form,
        refineCore: {
          onFinish: mocks.onFinish,
          query: mocks.queryData
            ? { data: { data: mocks.queryData } }
            : undefined,
        },
      };
    },
  };
});

import { emptyLogSinkFormValues } from "@/domains/log-sink/lib/log-sink-form";
import { useLogSinkForm } from "./use-log-sink-form";

let submit: () => Promise<unknown>;
let validate: () => Promise<boolean>;

function Form({ action }: { action: "create" | "edit" }) {
  const { form, metadataFields, specFields } = useLogSinkForm({ action });
  submit = () =>
    form.refineCore.onFinish(form.getValues() as LogSinkFormValues);
  validate = () => form.trigger();
  return (
    <FormProvider {...form}>
      <form>
        {metadataFields}
        {specFields}
      </form>
    </FormProvider>
  );
}

function selectOption(fieldTestId: string, optionLabel: string) {
  const field = screen.getByTestId(fieldTestId);
  const trigger = field.querySelector('button[role="combobox"]');
  if (!trigger) throw new Error("select trigger not found");
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("option", { name: optionLabel }));
}

const input = (testId: string) => {
  const el = screen.getByTestId(testId).querySelector("input");
  if (!el) throw new Error(`input not found in ${testId}`);
  return el;
};

beforeEach(() => {
  mocks.onFinish.mockClear();
  mocks.mutateAsync.mockClear();
  mocks.queryData = undefined;
});

describe("useLogSinkForm", () => {
  it("create: submit and test connection send the same bearer spec", async () => {
    render(<Form action="create" />);
    fireEvent.change(input("field-metadata.name"), {
      target: { value: "vl" },
    });
    fireEvent.change(input("field-spec.victorialogs.url"), {
      target: { value: "https://vl:9428" },
    });
    selectOption(
      "field-spec.victorialogs.auth.type",
      "log_sinks.authTypes.bearer",
    );
    fireEvent.change(input("field-spec.victorialogs.auth.token"), {
      target: { value: "secret" },
    });
    fireEvent.change(input("field-spec.buffer.max_size_gib"), {
      target: { value: "1.5" },
    });

    const spec = {
      type: "victorialogs",
      enabled: true,
      victorialogs: {
        url: "https://vl:9428",
        auth: { type: "bearer", token: "secret" },
      },
      buffer: { max_size: 1610612736 },
    };

    await submit();
    expect(mocks.onFinish).toHaveBeenCalledWith({
      api_version: "v1",
      kind: "LogSink",
      metadata: { name: "vl" },
      spec,
    });

    fireEvent.click(screen.getByTestId("log-sink-test-connection"));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({
      url: "/log_sinks/test_connection",
      method: "post",
      values: { spec },
    });
  });

  it("edit with a blank secret: keeps it out of the PATCH and the test", async () => {
    const stored = emptyLogSinkFormValues();
    stored.metadata.name = "vl";
    stored.spec.victorialogs.url = "https://vl:9428";
    stored.spec.victorialogs.auth.type = "basic";
    stored.spec.victorialogs.auth.username = "u";
    mocks.queryData = { ...stored, id: 7 };

    render(<Form action="edit" />);
    expect(input("field-metadata.name").disabled).toBe(true);
    expect(
      (input("field-spec.victorialogs.auth.password") as HTMLInputElement)
        .value,
    ).toBe("");

    const spec = {
      type: "victorialogs",
      enabled: true,
      victorialogs: {
        url: "https://vl:9428",
        auth: { type: "basic", username: "u" },
      },
    };

    await submit();
    expect(mocks.onFinish).toHaveBeenCalledWith({ spec });

    fireEvent.click(screen.getByTestId("log-sink-test-connection"));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({
      values: { id: 7, spec },
    });
    expect(await screen.findByTestId("log-sink-test-result")).toBeTruthy();
  });
  it("create s3: shows only s3 fields; submit and test send only spec.s3", async () => {
    render(<Form action="create" />);
    selectOption("field-spec.type", "log_sinks.types.s3");
    expect(screen.queryByTestId("field-spec.victorialogs.url")).toBeNull();
    // Region, bucket and both keys are required at create.
    expect(await validate()).toBe(false);
    fireEvent.change(input("field-metadata.name"), {
      target: { value: "archive" },
    });
    fireEvent.change(input("field-spec.s3.endpoint"), {
      target: { value: "http://demo-s3:9000" },
    });
    fireEvent.change(input("field-spec.s3.region"), {
      target: { value: "us-east-1" },
    });
    fireEvent.change(input("field-spec.s3.bucket"), {
      target: { value: "traces" },
    });
    fireEvent.change(input("field-spec.s3.auth.access_key_id"), {
      target: { value: "ak" },
    });
    fireEvent.change(input("field-spec.s3.auth.secret_access_key"), {
      target: { value: "sk" },
    });
    fireEvent.change(input("field-spec.s3.flush_interval_seconds"), {
      target: { value: "10" },
    });
    // The hidden VictoriaLogs URL (empty) does not block an s3 sink.
    expect(await validate()).toBe(true);

    const spec = {
      type: "s3",
      enabled: true,
      s3: {
        endpoint: "http://demo-s3:9000",
        region: "us-east-1",
        bucket: "traces",
        flush_interval_seconds: 10,
        auth: { access_key_id: "ak", secret_access_key: "sk" },
      },
    };

    await submit();
    expect(mocks.onFinish).toHaveBeenCalledWith({
      api_version: "v1",
      kind: "LogSink",
      metadata: { name: "archive" },
      spec,
    });

    fireEvent.click(screen.getByTestId("log-sink-test-connection"));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({
      values: { spec },
    });
  });

  it("edit s3 with blank keys: type locked, keys left out of the PATCH and the test", async () => {
    const stored = emptyLogSinkFormValues();
    stored.metadata.name = "archive";
    stored.spec.type = "s3";
    stored.spec.s3.region = "us-east-1";
    stored.spec.s3.bucket = "traces";
    mocks.queryData = { ...stored, id: 9 };

    render(<Form action="edit" />);
    expect(
      screen
        .getByTestId("field-spec.type")
        .querySelector('button[role="combobox"]')
        ?.hasAttribute("disabled"),
    ).toBe(true);
    expect(
      (input("field-spec.s3.auth.secret_access_key") as HTMLInputElement).value,
    ).toBe("");

    const spec = {
      type: "s3",
      enabled: true,
      s3: { region: "us-east-1", bucket: "traces" },
    };
    await submit();
    expect(mocks.onFinish).toHaveBeenCalledWith({ spec });

    fireEvent.click(screen.getByTestId("log-sink-test-connection"));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
    expect(mocks.mutateAsync.mock.calls[0][0]).toMatchObject({
      values: { id: 9, spec },
    });
  });
});
