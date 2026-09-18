import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";
import { FormProvider } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { ModelRoute } from "@/domains/external-endpoint/types";

const submitEndpoint = vi.hoisted(() => vi.fn());

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { model?: string }) =>
      values?.model ? `${key}: ${values.model}` : key,
  }),
}));

vi.mock("@/foundation/components/BaseStatus", () => ({
  default: ({ translatedPhase }: { translatedPhase: string }) => (
    <span>{translatedPhase}</span>
  ),
}));

vi.mock("@refinedev/react-hook-form", async () => {
  const rhf =
    await vi.importActual<typeof import("react-hook-form")>("react-hook-form");
  return {
    useForm: (opts: Record<string, unknown>) => {
      const { refineCoreProps, warnWhenUnsavedChanges, ...rhfOpts } = opts;
      return {
        ...rhf.useForm(rhfOpts),
        refineCore: { onFinish: submitEndpoint },
      };
    },
  };
});

vi.mock("@refinedev/core", () => ({
  useSelect: () => ({
    query: {
      data: {
        data: [
          {
            metadata: { name: "endpoint-running" },
            status: { phase: "Running" },
          },
          {
            metadata: { name: "endpoint-deploying" },
            status: { phase: "Deploying" },
          },
          {
            metadata: { name: "endpoint-unknown" },
          },
        ],
      },
      isLoading: false,
    },
    options: [],
  }),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
  isValidWorkspace: (v: string | undefined | null) => !!v && v !== "_all_",
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div data-testid="workspace-field-mock" />),
}));

vi.mock(
  "@/domains/external-endpoint/components/TestConnectivityButton",
  () => ({
    default: () => <div data-testid="test-connectivity-mock" />,
  }),
);

const mockConnectivityTest = vi.fn().mockResolvedValue({ success: false });
vi.mock("@/domains/external-endpoint/hooks/use-test-connectivity", () => ({
  useTestConnectivity: () => ({
    test: mockConnectivityTest,
    testingMap: {},
    resultMap: {},
  }),
}));

vi.mock("@/foundation/components/FormSelect", () => ({
  FormSelect: React.forwardRef(
    (
      props: {
        id?: string;
        "aria-label"?: string;
        value?: string;
        onChange?: (v: string) => void;
        options?: { label: string; value: string }[];
      },
      ref: any,
    ) => (
      <select
        id={props.id}
        aria-label={props["aria-label"]}
        ref={ref}
        data-testid="form-select-mock"
        value={props.value}
        onChange={(e) => props.onChange?.(e.target.value)}
      >
        {!props.value && <option value="">placeholder</option>}
        {props.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ),
  ),
}));

vi.mock("@/domains/external-endpoint/components/TimeoutInput", () => ({
  default: React.forwardRef(
    (props: { value?: number; onChange?: (v: number) => void }, ref: any) => (
      <input
        ref={ref}
        data-testid="timeout-input-mock"
        type="number"
        value={props.value ?? ""}
        onChange={(e) => props.onChange?.(Number(e.target.value))}
      />
    ),
  ),
}));

vi.mock("@/foundation/components/FormCombobox", () => ({
  FormCombobox: ({
    onChange,
    placeholder,
    options,
    renderOption,
  }: {
    onChange?: (v: string) => void;
    placeholder?: string;
    options?: { label: string; value: string }[];
    renderOption?: (option: {
      label: string;
      value: string;
    }) => React.ReactNode;
  }) => (
    <div>
      <input
        data-testid="form-combobox-mock"
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {options?.map((option) => (
        <div key={option.value}>{renderOption?.(option) ?? option.label}</div>
      ))}
    </div>
  ),
}));

import { useExternalEndpointForm } from "./use-external-endpoint-form";

function RoutingForm({ routes }: { routes: ModelRoute[] }) {
  const { form, specFields } = useExternalEndpointForm({ action: "edit" });
  const { setValue } = form;
  React.useEffect(() => {
    setValue("spec.model_routes", routes);
  }, [setValue, routes]);
  return (
    <FormProvider {...form}>
      <form>
        {specFields}
        <button
          type="button"
          onClick={() => form.refineCore.onFinish(form.getValues())}
        >
          submit-capacity
        </button>
      </form>
    </FormProvider>
  );
}

describe("target concurrent request limits", () => {
  it.each(["fixed", "priority"] as const)(
    "edits and submits limits independently for %s targets",
    async (strategy) => {
      submitEndpoint.mockClear();
      const route: ModelRoute = {
        model: "chat",
        strategy,
        targets: Array.from(
          { length: strategy === "fixed" ? 1 : 2 },
          (_, index) => ({
            upstream: "provider-1",
            upstream_model: `model-${index}`,
            priority: strategy === "priority" ? index * 20 : 0,
            weight: 13,
            max_inflight_requests: index === 0 ? 2 : 8,
          }),
        ),
      };
      render(<RoutingForm routes={[route]} />);
      const limits = await screen.findAllByRole("spinbutton", {
        name: "external_endpoints.fields.maxInflightRequests",
      });
      expect(limits).toHaveLength(route.targets.length);
      expect(limits.map((input) => (input as HTMLInputElement).value)).toEqual(
        strategy === "fixed" ? ["2"] : ["2", "8"],
      );
      for (const [index, input] of limits.entries()) {
        fireEvent.change(input, { target: { value: String(index + 4) } });
        fireEvent.blur(input);
      }
      await act(async () =>
        fireEvent.click(screen.getByText("submit-capacity")),
      );
      expect(
        submitEndpoint.mock.lastCall?.[0].spec.model_routes[0].targets,
      ).toEqual(
        route.targets.map((target, index) => ({
          ...target,
          max_inflight_requests: index + 4,
        })),
      );

      for (const value of ["", "0"]) {
        fireEvent.change(limits[0], { target: { value } });
        fireEvent.blur(limits[0]);
        await act(async () =>
          fireEvent.click(screen.getByText("submit-capacity")),
        );
        expect(
          submitEndpoint.mock.lastCall?.[0].spec.model_routes[0].targets[0]
            .max_inflight_requests,
        ).toBe(value === "" ? undefined : 0);
      }
      for (const value of ["-1", "1.5", "2147483648"]) {
        fireEvent.change(limits[0], { target: { value } });
        expect((limits[0] as HTMLInputElement).checkValidity()).toBe(false);
      }
    },
  );
});

describe("routing rule editor", () => {
  it("keeps hidden weighted capacity and updates the title while editing", async () => {
    const route: ModelRoute = {
      model: "weighted",
      strategy: "weighted",
      targets: [
        {
          upstream: "a",
          upstream_model: "first",
          weight: 50,
          max_inflight_requests: 2,
        },
        {
          upstream: "b",
          upstream_model: "second",
          weight: 50,
          max_inflight_requests: 8,
        },
      ],
    };
    render(<RoutingForm routes={[route]} />);
    expect(
      screen.queryByRole("spinbutton", {
        name: "external_endpoints.fields.maxInflightRequests",
      }),
    ).toBeNull();
    fireEvent.change(
      screen.getByLabelText("external_endpoints.fields.virtualModelName"),
      { target: { value: "renamed" } },
    );
    expect(
      screen.getByRole("heading", {
        name: "external_endpoints.sections.routeConfiguration: renamed",
      }),
    ).toBeTruthy();
    fireEvent.blur(
      screen.getByLabelText("external_endpoints.fields.virtualModelName"),
    );
    const models = screen.getAllByLabelText(
      "external_endpoints.fields.upstreamModelName",
    );
    fireEvent.change(models[0], { target: { value: "updated" } });
    fireEvent.blur(models[0]);
    await act(async () => fireEvent.click(screen.getByText("submit-capacity")));
    expect(
      submitEndpoint.mock.lastCall?.[0].spec.model_routes[0],
    ).toMatchObject({
      model: "renamed",
      targets: [
        { ...route.targets[0], upstream_model: "updated" },
        route.targets[1],
      ],
    });
  });

  it("offers target actions only in multi-target strategies and follows refreshed data", () => {
    const fixed: ModelRoute = {
      model: "fixed",
      strategy: "fixed",
      targets: [{ upstream: "a", upstream_model: "first" }],
    };
    const { rerender } = render(<RoutingForm routes={[fixed]} />);
    expect(
      screen.queryByRole("button", {
        name: "external_endpoints.actions.removeTarget",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "external_endpoints.actions.addWeightedTarget",
      }),
    ).toBeNull();
    fireEvent.change(
      screen.getByLabelText("external_endpoints.fields.routingMode"),
      { target: { value: "priority" } },
    );
    const primary = screen.getByRole("table", {
      name: "external_endpoints.sections.primaryTargets",
    });
    const backup = screen.getByRole("table", {
      name: "external_endpoints.sections.fallbackTargets",
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "external_endpoints.actions.addPrimaryTarget",
      }),
    );
    expect(within(primary).getAllByRole("spinbutton")).toHaveLength(2);
    expect(within(backup).getAllByRole("spinbutton")).toHaveLength(1);
    fireEvent.click(
      within(primary).getAllByRole("button", {
        name: "external_endpoints.actions.removeTarget",
      })[1],
    );
    expect(within(primary).getAllByRole("spinbutton")).toHaveLength(1);
    rerender(
      <RoutingForm
        routes={[
          {
            ...fixed,
            strategy: "weighted",
            targets: [{ ...fixed.targets[0], weight: 100 }],
          },
        ]}
      />,
    );
    expect(
      screen.getByLabelText("external_endpoints.fields.routingMode"),
    ).toHaveProperty("value", "weighted");
    expect(
      screen.queryByRole("spinbutton", {
        name: "external_endpoints.fields.maxInflightRequests",
      }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "external_endpoints.actions.addWeightedTarget",
      }),
    );
    expect(
      screen.getAllByRole("spinbutton", {
        name: "external_endpoints.fields.weightRatio",
      }),
    ).toHaveLength(2);
  });
});

describe("route weight submission validation", () => {
  it.each([
    { name: "fixed", weights: [1], priorities: [0], allowed: true },
    { name: "priority", weights: [1, 1], priorities: [0, 1], allowed: true },
    {
      name: "weighted 70/30",
      weights: [70, 30],
      priorities: [0, 0],
      allowed: true,
    },
    {
      name: "weighted 70/70",
      weights: [70, 70],
      priorities: [0, 0],
      allowed: false,
    },
  ])("validates $name", async ({ weights, priorities, allowed }) => {
    submitEndpoint.mockClear();
    const { result } = renderHook(() =>
      useExternalEndpointForm({ action: "create" }),
    );
    const values = result.current.form.getValues();
    values.spec.model_routes = [
      {
        model: "chat",
        strategy:
          weights.length === 1
            ? "fixed"
            : priorities.some((priority) => priority !== 0)
              ? "priority"
              : "weighted",
        targets: weights.map((weight, index) => ({
          upstream: `provider-${index + 1}`,
          upstream_model: "chat",
          priority: priorities[index],
          weight,
        })),
      },
    ];
    await act(async () => {
      await result.current.form.refineCore.onFinish(values);
    });
    expect(submitEndpoint).toHaveBeenCalledTimes(allowed ? 1 : 0);
    expect(result.current.form.getFieldState("spec.model_routes").invalid).toBe(
      !allowed,
    );
  });

  it("rejects duplicate model service names before submit", async () => {
    submitEndpoint.mockClear();
    const { result } = renderHook(() =>
      useExternalEndpointForm({ action: "create" }),
    );
    const values = result.current.form.getValues();
    values.spec.upstreams = [
      {
        name: "same",
        upstream: { url: "https://one.example/v1" },
        auth: { type: "bearer", credential: "token" },
        model_mapping: {},
        models: null,
      },
      {
        name: "same",
        upstream: { url: "https://two.example/v1" },
        auth: { type: "bearer", credential: "token" },
        model_mapping: {},
        models: null,
      },
    ];
    values.spec.model_routes = [
      {
        model: "chat",
        strategy: "fixed",
        targets: [{ upstream: "same", upstream_model: "chat", weight: 100 }],
      },
    ];
    await act(async () => {
      await result.current.form.refineCore.onFinish(values);
    });
    expect(submitEndpoint).not.toHaveBeenCalled();
    expect(result.current.form.getFieldState("spec.model_routes").invalid).toBe(
      true,
    );
  });

  it("rejects routes without an explicit strategy", async () => {
    submitEndpoint.mockClear();
    const { result } = renderHook(() =>
      useExternalEndpointForm({ action: "create" }),
    );
    const values = result.current.form.getValues();
    values.spec.model_routes = [
      {
        model: "chat",
        targets: [{ upstream: "provider-1", upstream_model: "chat" }],
      },
    ];
    await act(async () => {
      await result.current.form.refineCore.onFinish(values);
    });
    expect(submitEndpoint).not.toHaveBeenCalled();
    expect(result.current.form.getFieldState("spec.model_routes").invalid).toBe(
      true,
    );
  });
});

function CreateForm() {
  const { form, metadataFields, specFields } = useExternalEndpointForm({
    action: "create",
  });
  return (
    <FormProvider {...form}>
      <form>
        {metadataFields}
        {specFields}
      </form>
    </FormProvider>
  );
}

function renderCreateForm() {
  render(<CreateForm />);
}

describe("provider rename and legacy migration", () => {
  it.each(["create", "edit"] as const)(
    "preserves renamed references on %s submission",
    async (action) => {
      submitEndpoint.mockClear();
      const routes = ["chat", "other"].map((model) => ({
        model,
        strategy: "fixed" as const,
        targets: [{ upstream: "provider-1", upstream_model: model, weight: 1 }],
      }));
      function Harness() {
        const { form, specFields } = useExternalEndpointForm({ action });
        React.useEffect(() => {
          form.reset({
            ...form.getValues(),
            metadata: { name: "rename-test", workspace: "default" },
            spec: {
              timeout: 60000,
              upstreams: [
                {
                  name: action === "create" ? undefined : "provider-1",
                  upstream: { url: "https://example.com" },
                  model_mapping: { chat: "chat" },
                  models: null,
                },
              ],
              model_routes: routes,
            },
          });
        }, [form.reset, form.getValues]);
        return (
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(form.refineCore.onFinish)}>
              {specFields}
              <button type="submit">Save test endpoint</button>
            </form>
          </FormProvider>
        );
      }
      const view = render(<Harness />);
      await waitFor(() =>
        expect(
          screen
            .getAllByRole("button")
            .find((button) => button.querySelector(".lucide-chevron-down")),
        ).toBeTruthy(),
      );
      const upstreamTrigger = screen
        .getAllByRole("button")
        .find((button) => button.querySelector(".lucide-chevron-down"));
      if (upstreamTrigger) fireEvent.click(upstreamTrigger);
      const input = view.getByPlaceholderText(
        "external_endpoints.placeholders.provider",
      );
      fireEvent.change(input, { target: { value: "openai" } });
      fireEvent.change(input, { target: { value: "renamed-again" } });
      fireEvent.click(view.getByText("Save test endpoint"));
      await waitFor(() => expect(submitEndpoint).toHaveBeenCalledOnce());
      const spec = submitEndpoint.mock.calls[0][0].spec;
      expect(spec.upstreams[0].name).toBe("renamed-again");
      expect(
        spec.model_routes.map(
          (route: { targets: { upstream: string }[] }) =>
            route.targets[0].upstream,
        ),
      ).toEqual(["renamed-again", "renamed-again"]);
      expect(spec.upstreams[0].model_mapping).toEqual({});
      view.unmount();
    },
  );

  it.each([
    { name: "legacy", modelRoutes: undefined },
    { name: "deleted", modelRoutes: [] },
  ])(
    "migrates legacy routes without restoring explicit deletions ($name)",
    async ({ modelRoutes }) => {
      submitEndpoint.mockClear();
      const { result } = renderHook(() =>
        useExternalEndpointForm({ action: "edit" }),
      );
      const values = result.current.form.getValues();
      values.spec.upstreams = [
        { name: "a", model_mapping: { chat: "actual-chat" }, models: null },
        {
          name: "b",
          model_mapping: { embedding: "actual-embedding" },
          models: null,
        },
      ];
      values.spec.model_routes = modelRoutes;
      await act(async () => {
        await result.current.form.refineCore.onFinish(values);
      });
      const spec = submitEndpoint.mock.calls[0][0].spec;
      expect(
        spec.upstreams.map(
          (upstream: { model_mapping: unknown }) => upstream.model_mapping,
        ),
      ).toEqual([{}, {}]);
      expect(spec).not.toHaveProperty("model_mapping");
      expect(
        spec.model_routes.map((route: { model: string }) => route.model),
      ).toEqual(modelRoutes === undefined ? ["chat", "embedding"] : []);
    },
  );
});

function EditForm() {
  const { form, metadataFields, specFields } = useExternalEndpointForm({
    action: "edit",
  });
  return (
    <FormProvider {...form}>
      <form>
        {metadataFields}
        {specFields}
      </form>
    </FormProvider>
  );
}

describe("useExternalEndpointForm", () => {
  describe("create mode", () => {
    it("starts with an editable fixed route without a fake provider selection", async () => {
      renderCreateForm();

      await waitFor(() =>
        expect(
          screen.getByLabelText("external_endpoints.fields.virtualModelName"),
        ).toHaveProperty("value", ""),
      );
      expect(
        screen.getByLabelText("external_endpoints.fields.upstreamModelName"),
      ).toHaveProperty("value", "");
      const selects = screen.getAllByTestId("form-select-mock");
      expect(
        selects.find((select) => select.querySelector('option[value="fixed"]')),
      ).toHaveProperty("value", "fixed");
      expect(
        selects.find((select) =>
          select.querySelector('option[value="provider-1"]'),
        ),
      ).toBeUndefined();

      fireEvent.click(
        screen.getByRole("button", {
          name: "external_endpoints.actions.removeVirtualModel",
        }),
      );
      expect(
        screen.queryByLabelText("external_endpoints.fields.virtualModelName"),
      ).toBeNull();
      fireEvent.click(
        screen.getByText("external_endpoints.actions.addVirtualModel"),
      );
      expect(
        screen.getAllByLabelText("external_endpoints.fields.virtualModelName"),
      ).toHaveLength(1);
    });

    it("does not create an upstream channel until the user adds one", () => {
      renderCreateForm();
      expect(screen.getByLabelText("common.fields.name")).toBeTruthy();
      expect(screen.queryByTestId("field-_upstreamType_0")).toBeNull();
      expect(
        screen.queryByLabelText("external_endpoints.fields.upstreamUrl"),
      ).toBeNull();

      fireEvent.click(
        screen.getByText("external_endpoints.actions.addModelService"),
      );

      expect(screen.getByTestId("field-_upstreamType_0")).toBeTruthy();
      expect(
        screen.getByLabelText("external_endpoints.fields.upstreamUrl"),
      ).toBeTruthy();
      expect(
        screen.getByLabelText("external_endpoints.fields.credential"),
      ).toBeTruthy();
    });

    it("shows validation error when name is empty", async () => {
      renderCreateForm();
      const nameInput = screen.getByLabelText("common.fields.name");
      fireEvent.change(nameInput, { target: { value: "a" } });
      fireEvent.change(nameInput, { target: { value: "" } });
      fireEvent.blur(nameInput);

      await waitFor(() => {
        expect(
          screen.getByText("external_endpoints.validation.nameRequired"),
        ).toBeTruthy();
      });
    });

    it("shows validation error when upstream URL is empty", async () => {
      renderCreateForm();
      fireEvent.click(
        screen.getByText("external_endpoints.actions.addModelService"),
      );
      const urlInput = screen.getByLabelText(
        "external_endpoints.fields.upstreamUrl",
      );
      fireEvent.change(urlInput, { target: { value: "a" } });
      fireEvent.change(urlInput, { target: { value: "" } });
      fireEvent.blur(urlInput);

      await waitFor(() => {
        expect(
          screen.getByText("external_endpoints.validation.upstreamUrlRequired"),
        ).toBeTruthy();
      });
    });

    it("name field is not disabled", () => {
      renderCreateForm();
      const nameInput = screen.getByLabelText("common.fields.name");
      expect((nameInput as HTMLInputElement).disabled).toBe(false);
    });

    it("renders timeout field", () => {
      renderCreateForm();
      expect(screen.getByTestId("timeout-input-mock")).toBeTruthy();
    });

    it("adds a new upstream when add button is clicked", async () => {
      renderCreateForm();
      expect(
        screen.queryAllByLabelText("external_endpoints.fields.upstreamUrl"),
      ).toHaveLength(0);

      fireEvent.click(
        screen.getByText("external_endpoints.actions.addModelService"),
      );

      await waitFor(() => {
        expect(
          screen.getAllByLabelText("external_endpoints.fields.upstreamUrl"),
        ).toHaveLength(1);
      });

      fireEvent.click(
        screen.getByText("external_endpoints.actions.addModelService"),
      );
      await waitFor(() => {
        expect(
          screen.getAllByLabelText("external_endpoints.fields.upstreamUrl"),
        ).toHaveLength(2);
      });
    });

    it("removes an upstream when remove button is clicked", async () => {
      renderCreateForm();
      // Add two upstreams first so the first one can be removed.
      fireEvent.click(
        screen.getByText("external_endpoints.actions.addModelService"),
      );
      fireEvent.click(
        screen.getByText("external_endpoints.actions.addModelService"),
      );

      await waitFor(() => {
        expect(
          screen.getAllByLabelText("external_endpoints.fields.upstreamUrl"),
        ).toHaveLength(2);
      });

      // Remove the first upstream (trash buttons are now enabled)
      const removeButtons = screen.getAllByRole("button", { name: "" });
      const trashButton = removeButtons.find(
        (btn) => btn.querySelector(".lucide-trash-2") !== null,
      );
      if (trashButton) fireEvent.click(trashButton);

      await waitFor(() => {
        expect(
          screen.getAllByLabelText("external_endpoints.fields.upstreamUrl"),
        ).toHaveLength(1);
      });
    });

    it("does not auto-create virtual models from connectivity results", async () => {
      renderCreateForm();
      fireEvent.click(
        screen.getByText("external_endpoints.actions.addModelService"),
      );
      const typeSelect = screen
        .getAllByTestId("form-select-mock")
        .find((select) => select.querySelector('option[value="endpoint_ref"]'));
      expect(typeSelect).toBeTruthy();
      fireEvent.change(typeSelect!, { target: { value: "endpoint_ref" } });
      mockConnectivityTest.mockResolvedValueOnce({
        success: true,
        models: ["model-a", "model-b"],
      });
      const combobox = await screen.findByTestId("form-combobox-mock");
      fireEvent.change(combobox, { target: { value: "endpoint-1" } });
      await waitFor(() => {
        expect(screen.queryByDisplayValue("model-a")).toBeNull();
        expect(screen.queryByDisplayValue("model-b")).toBeNull();
      });
    });

    it("renders endpoint ref phases as status tags instead of label text", () => {
      renderCreateForm();
      fireEvent.click(
        screen.getByText("external_endpoints.actions.addModelService"),
      );
      const typeSelect = screen
        .getAllByTestId("form-select-mock")
        .find((select) => select.querySelector('option[value="endpoint_ref"]'));
      expect(typeSelect).toBeTruthy();
      fireEvent.change(typeSelect!, {
        target: { value: "endpoint_ref" },
      });

      expect(screen.getByText("endpoint-running")).toBeTruthy();
      expect(screen.getByText("status.phases.endpoint.Running")).toBeTruthy();
      expect(screen.getByText("status.phases.endpoint.Deploying")).toBeTruthy();
      expect(screen.getByText("endpoint-unknown")).toBeTruthy();
      expect(screen.queryByText("endpoint-running (Running)")).toBeNull();
    });

    it("newly added upstream renders external type fields", () => {
      renderCreateForm();
      fireEvent.click(
        screen.getByText("external_endpoints.actions.addModelService"),
      );
      // External type fields should be visible
      expect(
        screen.getByLabelText("external_endpoints.fields.upstreamUrl"),
      ).toBeTruthy();
      expect(
        screen.getByLabelText("external_endpoints.fields.credential"),
      ).toBeTruthy();
      // Endpoint ref field should NOT be visible
      expect(
        screen.queryByLabelText("external_endpoints.fields.endpointRef"),
      ).toBeNull();
    });
  });

  describe("edit mode", () => {
    it("does not initialize a new route before existing data loads", () => {
      const { result } = renderHook(() =>
        useExternalEndpointForm({ action: "edit" }),
      );
      expect(
        result.current.form.getValues("spec.model_routes"),
      ).toBeUndefined();
    });

    it("disables name field", () => {
      render(<EditForm />);
      const nameInput = screen.getByLabelText("common.fields.name");
      expect((nameInput as HTMLInputElement).disabled).toBe(true);
    });

    // Credential hint ("leaveEmptyToKeepValue") is rendered inside
    // upstream cards. In unit tests the mock useForm has no refineCore
    // query, so the edit form starts with an empty upstreams array and
    // no cards are rendered. The hint is implicitly covered by the
    // create-mode tests that render upstream fields.
  });
});
