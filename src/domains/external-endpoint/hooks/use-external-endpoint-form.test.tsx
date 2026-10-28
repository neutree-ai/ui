import {
  act,
  fireEvent,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeExternalEndpoint,
  makeRoute,
  makeTarget,
  makeUpstream,
} from "@/domains/external-endpoint/testing/fixtures";
import type {
  ExternalEndpoint,
  ExternalEndpointSpec,
  ModelRoute,
} from "@/domains/external-endpoint/types";
import { fillField } from "@/foundation/testing/interactions";
import { refineForm } from "@/foundation/testing/refine-form";
import { renderForm } from "@/foundation/testing/render-form";
import { useExternalEndpointForm } from "./use-external-endpoint-form";

const modelListQuery = vi.hoisted(() =>
  vi.fn(() => ({
    data: { data: { success: true, models: ["selected-model"] } },
    isFetching: false,
    isError: false,
  })),
);
const connectivityTest = vi.hoisted(() => vi.fn());

vi.mock("@refinedev/core", () => ({
  useCustom: modelListQuery,
  // Sibling external endpoints, read for the model sources already in use.
  useList: () => ({
    data: {
      data: [
        {
          spec: {
            model_sources: { "other-model": "acme-research-lab" },
            upstreams: [{ model_mapping: { "other-model": "upstream" } }],
          },
        },
        {
          spec: {
            model_sources: { removed: "retired-lab" },
            upstreams: [{ model_mapping: { kept: "upstream" } }],
          },
        },
      ],
    },
  }),
  useSelect: () => ({
    query: {
      data: {
        data: [
          {
            metadata: { name: "endpoint-deploying" },
            status: { phase: "Deploying" },
          },
          { metadata: { name: "endpoint-unknown" } },
          {
            metadata: { name: "endpoint-running" },
            status: { phase: "Running" },
          },
        ],
      },
      isLoading: false,
    },
  }),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
  isValidWorkspace: (v: string | undefined | null) => !!v && v !== "_all_",
}));

vi.mock("@/foundation/components/WorkspaceField", () => ({
  default: React.forwardRef(() => <div />),
}));

// Needs a TooltipProvider the form does not render.
vi.mock("@/foundation/components/BaseStatus", () => ({
  default: ({ translatedPhase }: { translatedPhase: string }) => (
    <span>{translatedPhase}</span>
  ),
}));

vi.mock("@/domains/external-endpoint/hooks/use-test-connectivity", () => ({
  useTestConnectivity: () => ({
    test: connectivityTest,
    testingMap: {},
    resultMap: {},
  }),
}));

// Radix Select and cmdk are replaced by native inputs so the many route
// selectors can be driven by label with a single change event.
vi.mock("@/foundation/components/FormSelect", async () => {
  const { FormControl } = await import("@/components/ui/form");
  return {
    FormSelect: React.forwardRef(
      (
        props: {
          value?: string;
          disabled?: boolean;
          onChange?: (v: string) => void;
          options?: { label: string; value: string }[];
        },
        ref: React.Ref<HTMLSelectElement>,
      ) => (
        <FormControl>
          <select
            ref={ref}
            value={props.value}
            disabled={props.disabled}
            onChange={(e) => props.onChange?.(e.target.value)}
          >
            {!props.value && <option value="">placeholder</option>}
            {props.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormControl>
      ),
    ),
  };
});

vi.mock("@/foundation/components/FormCombobox", () => ({
  // The model-source combobox is the only one accepting a typed value.
  FormCombobox: ({
    onChange,
    options,
    renderOption,
    allowCustomValue,
  }: {
    onChange?: (v: string) => void;
    options?: { label: string; value: string }[];
    renderOption?: (option: {
      label: string;
      value: string;
    }) => React.ReactNode;
    allowCustomValue?: boolean;
  }) => {
    const kind = allowCustomValue ? "model-source" : "endpoint-ref";
    return (
      <div>
        <input
          data-testid={`${kind}-input`}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <div
          data-testid={`${kind}-options`}
          data-values={(options ?? []).map((o) => o.value).join(",")}
        >
          {options?.map((option) => (
            <div key={option.value}>
              {renderOption?.(option) ?? option.label}
            </div>
          ))}
        </div>
      </div>
    );
  },
}));

type Select = (response: { data: ExternalEndpoint }) => {
  data: ExternalEndpoint;
};
const selectRecord = (record: ExternalEndpoint) =>
  (
    refineForm.options as {
      refineCoreProps: { queryOptions: { select: Select } };
    }
  ).refineCoreProps.queryOptions.select({ data: record }).data;

/** Renders the whole form; with `spec`, loads it as Refine would. */
function renderEndpointForm({
  action = "edit",
  spec,
}: {
  action?: "create" | "edit";
  spec?: Partial<ExternalEndpointSpec>;
} = {}) {
  const view = renderForm(
    () => useExternalEndpointForm({ action }),
    (r) => (
      <>
        {r.metadataFields}
        {r.specFields}
      </>
    ),
  );
  if (spec) {
    const record = makeExternalEndpoint(spec);
    // Refine only runs `select` on a loaded record; a create form gets a draft.
    act(() =>
      view.result.current.form.reset(
        action === "edit" ? selectRecord(record) : record,
      ),
    );
  }
  return view;
}

/** One upstream per provider the routes reference. */
const routesSpec = (...routes: ModelRoute[]) => ({
  upstreams: [
    ...new Set(routes.flatMap((r) => r.targets.map((t) => t.upstream))),
  ].map((name) => makeUpstream({ name })),
  model_routes: routes,
});

async function submit({
  result,
}: ReturnType<typeof renderEndpointForm>): Promise<void> {
  await act(() =>
    result.current.form.handleSubmit(result.current.form.refineCore.onFinish)(),
  );
}
const submitted = () =>
  refineForm.onFinish.mock.lastCall?.[0].spec as ExternalEndpointSpec;

/** Calls the submit adapter directly, without rendering any field. */
async function finishWith(
  spec: Partial<ExternalEndpointSpec>,
  action: "create" | "edit" = "edit",
) {
  const { result } = renderHook(() => useExternalEndpointForm({ action }));
  const initial = result.current.form.getValues();
  const values = { ...initial, spec: { ...initial.spec, ...spec } };
  act(() => result.current.form.reset(values));
  await act(() => result.current.form.refineCore.onFinish(values));
  return result;
}

const field = (key: string) =>
  screen.getAllByLabelText(`external_endpoints.fields.${key}`) as (
    | HTMLInputElement
    | HTMLSelectElement
  )[];
const change = (element: Element, value: string) =>
  fireEvent.change(element, { target: { value } });
const clickAction = (name: string, index = 0) =>
  fireEvent.click(
    screen.getAllByRole("button", {
      name: `external_endpoints.actions.${name}`,
    })[index],
  );
const table = (name: "primaryTargets" | "fallbackTargets") =>
  screen.getByRole("table", { name: `external_endpoints.sections.${name}` });

beforeEach(() => {
  modelListQuery.mockClear();
  connectivityTest.mockReset();
});

describe("create vs edit", () => {
  it.each([
    {
      action: "create" as const,
      nameDisabled: false,
      routes: [
        {
          model: "",
          strategy: "fixed",
          targets: [{ upstream: "", upstream_model: "" }],
        },
      ],
    },
    { action: "edit" as const, nameDisabled: true, routes: undefined },
  ])(
    "$action starts with name disabled: $nameDisabled",
    ({ action, nameDisabled, routes }) => {
      const { result } = renderEndpointForm({ action });

      expect(screen.getByLabelText("common.fields.name")).toHaveProperty(
        "disabled",
        nameDisabled,
      );
      expect(result.current.form.getValues("spec.model_routes")).toEqual(
        routes,
      );
    },
  );

  it("shows the name and upstream URL required messages", async () => {
    renderEndpointForm({ action: "create" });
    fillField("metadata.name", "a");
    fillField("metadata.name", "");
    clickAction("addModelService");
    fillField("spec.upstreams.0.upstream.url", "a");
    fillField("spec.upstreams.0.upstream.url", "");

    await screen.findByText("external_endpoints.validation.nameRequired");
    await screen.findByText(
      "external_endpoints.validation.upstreamUrlRequired",
    );
  });
});

describe("model services", () => {
  it("adds external channels only on demand", () => {
    renderEndpointForm({ action: "create" });
    expect(
      screen.queryByLabelText("external_endpoints.fields.upstreamUrl"),
    ).toBeNull();

    clickAction("addModelService");
    screen.getByLabelText("external_endpoints.fields.credential");
    expect(
      screen.queryByLabelText("external_endpoints.fields.endpointRef"),
    ).toBeNull();
    clickAction("addModelService");

    expect(field("upstreamUrl")).toHaveLength(2);
  });

  it("switches a channel to an endpoint reference and loads its models without adding routes", async () => {
    const { result } = renderEndpointForm({ action: "create" });
    clickAction("addModelService");
    connectivityTest.mockResolvedValue({
      success: true,
      models: ["model-a", "model-b"],
    });

    change(
      within(screen.getByTestId("field-_upstreamType_0")).getByRole("combobox"),
      "endpoint_ref",
    );
    expect(
      screen.queryByLabelText("external_endpoints.fields.upstreamUrl"),
    ).toBeNull();
    expect(
      screen.getByTestId("endpoint-ref-options").getAttribute("data-values"),
    ).toBe("endpoint-running,endpoint-deploying,endpoint-unknown");
    change(screen.getByTestId("endpoint-ref-input"), "endpoint-running");

    await waitFor(() =>
      expect(connectivityTest).toHaveBeenCalledWith(0, {
        type: "endpoint_ref",
        endpoint_ref: "endpoint-running",
        workspace: "default",
      }),
    );
    expect(result.current.form.getValues("spec.upstreams.0")).toMatchObject({
      upstream: null,
      auth: null,
      endpoint_ref: "endpoint-running",
    });
    expect(
      result.current.form
        .getValues("spec.model_routes")
        ?.map((r: ModelRoute) => r.model),
    ).toEqual([""]);
  });

  it("queries models and tests connectivity with the remaining channel's saved identity after deletion and edits", async () => {
    const view = renderEndpointForm({
      spec: {
        upstreams: [
          makeUpstream({
            name: "a",
            upstream: { url: "https://a.example/v1" },
          }),
          makeUpstream({
            name: "b",
            upstream: { url: "https://b.example/v1" },
          }),
        ],
        model_routes: [makeRoute({ targets: [makeTarget({ upstream: "b" })] })],
      },
    });
    change(field("upstreamName")[1], "renamed-b");
    change(field("upstreamUrl")[1], "https://new-b.example/v1");
    clickAction("removeUpstream");

    const identity = {
      workspace: "default",
      name: "review-only",
      stored_upstream_url: "https://b.example/v1",
    };
    fireEvent.click(
      screen.getByRole("button", {
        name: "external_endpoints.messages.testConnectivity",
      }),
    );
    expect(connectivityTest).toHaveBeenCalledWith(0, {
      type: "external",
      url: "https://new-b.example/v1",
      credential: "",
      ...identity,
    });
    fireEvent.click(
      screen.getByRole("combobox", {
        name: "external_endpoints.fields.upstreamModelName",
      }),
    );
    expect(modelListQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: {
          payload: {
            upstream: { url: "https://new-b.example/v1" },
            auth: { type: "bearer", credential: "" },
            ...identity,
          },
        },
        queryOptions: expect.objectContaining({ enabled: true }),
      }),
    );
    fireEvent.click(
      await screen.findByRole("option", { name: "selected-model" }),
    );
    await submit(view);

    expect(submitted().model_routes?.[0]).toMatchObject({
      model: "chat",
      targets: [{ upstream: "renamed-b", upstream_model: "selected-model" }],
    });
  });

  it("removes the last channel with its routes, then accepts a replacement", async () => {
    const view = renderEndpointForm({ spec: {} });
    clickAction("removeUpstream");
    await submit(view);

    expect(submitted()).toMatchObject({ upstreams: [], model_routes: [] });
    clickAction("addModelService");
    screen.getByLabelText("external_endpoints.fields.upstreamUrl");
  });

  it("keeps a collapsed channel collapsed after deleting an earlier one", () => {
    renderEndpointForm({
      spec: {
        upstreams: [
          makeUpstream({ name: "first" }),
          makeUpstream({ name: "second" }),
        ],
        model_routes: [],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /second/ }));
    clickAction("removeUpstream");

    expect(
      screen
        .getByRole("button", { name: /second/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("blocks submission after deleting the channel of the only primary target", async () => {
    const view = renderEndpointForm({
      spec: routesSpec(
        makeRoute({
          strategy: "priority",
          targets: [
            makeTarget({ upstream: "a", max_inflight_requests: 1 }),
            makeTarget({ upstream: "b", priority: 1 }),
          ],
        }),
      ),
    });
    clickAction("removeUpstream");
    await submit(view);

    expect(refineForm.onFinish).not.toHaveBeenCalled();
    expect(view.result.current.submitBlocked).toBe(true);
  });
});

describe("channel references", () => {
  const twoRoutes = (first: string, second: string) => ({
    upstreams: [makeUpstream({ name: first }), makeUpstream({ name: second })],
    model_routes: [
      makeRoute({ model: "one", targets: [makeTarget({ upstream: first })] }),
      makeRoute({ model: "two", targets: [makeTarget({ upstream: second })] }),
    ],
  });
  const routedUpstreams = () =>
    submitted().model_routes?.map((route) => route.targets[0].upstream);

  it("names an unnamed channel on create and carries its rename into the routes", async () => {
    const view = renderEndpointForm({
      action: "create",
      spec: {
        upstreams: [
          makeUpstream({ name: undefined, model_mapping: { chat: "chat" } }),
        ],
        model_routes: [
          makeRoute({ targets: [makeTarget({ upstream: "provider-1" })] }),
          makeRoute({
            model: "other",
            targets: [makeTarget({ upstream: "provider-1" })],
          }),
        ],
      },
    });
    const name = field("upstreamName")[0];
    expect(name.value).toBe("provider-1");
    change(name, "openai");
    change(name, "renamed-again");
    await submit(view);

    expect(submitted().upstreams[0]).toMatchObject({
      name: "renamed-again",
      model_mapping: {},
    });
    expect(routedUpstreams()).toEqual(["renamed-again", "renamed-again"]);
  });

  it("renames through an intermediate name collision without stealing references", async () => {
    const view = renderEndpointForm({ spec: twoRoutes("a", "ab") });
    const name = field("upstreamName")[0];
    change(name, "ab");
    change(name, "abc");
    fireEvent.blur(name);
    // Field-array operations must not adopt edited names as new identities.
    clickAction("addModelService");
    change(field("upstreamUrl").at(-1)!, "https://third.example");
    await submit(view);

    expect(submitted().upstreams.map((u) => u.name)).toEqual([
      "abc",
      "ab",
      "provider-1",
    ]);
    expect(routedUpstreams()).toEqual(["abc", "ab"]);
    // A failed request leaves the editor mounted; a retry uses the same references.
    expect(field("provider")[0].value).toBe("a");
    await submit(view);
    expect(refineForm.onFinish).toHaveBeenCalledTimes(2);
  });

  it("keeps references when a name is cleared and names are swapped", async () => {
    const view = renderEndpointForm({ spec: twoRoutes("a", "b") });
    const [first, second] = field("upstreamName");
    change(first, "");
    change(first, "b");
    change(second, "a");
    await submit(view);

    expect(routedUpstreams()).toEqual(["b", "a"]);
  });

  it("keeps unnamed channels stable after deleting an earlier unused one", async () => {
    const view = renderEndpointForm({
      spec: {
        upstreams: ["a", "b", "c"].map((host) =>
          makeUpstream({
            name: undefined,
            upstream: { url: `https://${host}.example` },
          }),
        ),
        model_routes: [
          makeRoute({ targets: [makeTarget({ upstream: "provider-2" })] }),
        ],
      },
    });
    clickAction("removeUpstream");
    await submit(view);

    const target = routedUpstreams()?.[0];
    expect(
      submitted().upstreams.find((u) => u.name === target)?.upstream?.url,
    ).toBe("https://b.example");
  });
});

describe("quick-create channel", () => {
  const openQuickCreate = () => {
    change(field("provider")[0], "__quick_create_upstream__");
    const dialog = within(screen.getByRole("dialog"));
    change(
      dialog.getByPlaceholderText("external_endpoints.placeholders.provider"),
      "new-provider",
    );
    return dialog;
  };

  it("migrates legacy routes and points the target at the new channel", async () => {
    const view = renderEndpointForm({
      spec: {
        upstreams: [
          makeUpstream({
            name: "legacy",
            model_mapping: { chat: "old-model" },
          }),
        ],
        model_routes: null,
      },
    });
    screen.getByDisplayValue("chat");
    const dialog = openQuickCreate();
    change(
      dialog.getByPlaceholderText(
        "external_endpoints.placeholders.upstreamUrl",
      ),
      "https://new.example",
    );
    fireEvent.click(dialog.getByRole("button", { name: "buttons.save" }));
    // The Radix native select emits empty while a newly added option mounts.
    change(field("provider")[0], "");
    await submit(view);

    expect(submitted().model_routes).toEqual([
      makeRoute({ targets: [makeTarget({ upstream: "new-provider" })] }),
    ]);
    expect(submitted().upstreams.map((u) => u.model_mapping)).toEqual([{}, {}]);
  });

  it("creates an endpoint reference only for an offered instance", async () => {
    const view = renderEndpointForm({ spec: {} });
    const dialog = openQuickCreate();
    change(dialog.getByRole("combobox"), "endpoint_ref");
    const save = dialog.getByRole("button", { name: "buttons.save" });
    expect(save).toHaveProperty("disabled", true);
    change(dialog.getByTestId("endpoint-ref-input"), "missing-instance");
    expect(save).toHaveProperty("disabled", true);
    change(dialog.getByTestId("endpoint-ref-input"), "endpoint-running");
    fireEvent.click(save);
    await submit(view);

    expect(submitted().model_routes?.[0].targets[0].upstream).toBe(
      "new-provider",
    );
    const created = submitted().upstreams.find(
      (u) => u.name === "new-provider",
    );
    expect(created).toMatchObject({ endpoint_ref: "endpoint-running" });
    expect(created).not.toHaveProperty("upstream");
    expect(created).not.toHaveProperty("auth");
  });
});

describe("model source", () => {
  const sourceInput = () => screen.getAllByTestId("model-source-input")[0];
  const nameModel = (model: string) =>
    change(field("virtualModelName")[0], model);

  it("suggests the presets plus the sources sibling endpoints still use", () => {
    renderEndpointForm({ action: "create" });
    const offered =
      screen.getByTestId("model-source-options").getAttribute("data-values") ??
      "";

    expect(offered.split(",")).toContain("acme-research-lab");
    expect(offered.split(",")).not.toContain("retired-lab");
  });

  it("stores a typed source under the model name and drops it when cleared", () => {
    const { result } = renderEndpointForm({ action: "create" });
    nameModel("gpt-4o");
    change(sourceInput(), "new-lab");
    expect(result.current.form.getValues("spec.model_sources")).toEqual({
      "gpt-4o": "new-lab",
    });

    change(sourceInput(), "");
    expect(result.current.form.getValues("spec.model_sources")).toEqual({});
  });

  it("ignores a source typed before the model is named", () => {
    const { result } = renderEndpointForm({ action: "create" });
    change(sourceInput(), "partner");
    expect(result.current.form.getValues("spec.model_sources") ?? {}).toEqual(
      {},
    );
  });
});

describe("submit adapter", () => {
  const twoTargets = (
    strategy: ModelRoute["strategy"],
    ...targets: Partial<ReturnType<typeof makeTarget>>[]
  ) =>
    routesSpec(
      makeRoute({
        strategy,
        targets: targets.map((t, i) =>
          makeTarget({ upstream: `provider-${i + 1}`, ...t }),
        ),
      }),
    );

  it.each([
    {
      name: "weighted 70/30",
      spec: twoTargets("weighted", { weight: 70 }, { weight: 30 }),
      allowed: true,
    },
    {
      name: "weighted 70/70",
      spec: twoTargets("weighted", { weight: 70 }, { weight: 70 }),
      allowed: false,
    },
    {
      name: "priority without primary capacity",
      spec: twoTargets("priority", {}, { priority: 1 }),
      allowed: false,
    },
  ])("guards the routing strategy: $name", async ({ spec, allowed }) => {
    const result = await finishWith(spec);

    expect(refineForm.onFinish).toHaveBeenCalledTimes(allowed ? 1 : 0);
    expect(result.current.submitBlocked).toBe(!allowed);
    // The inline editor message explains it; no form-level error is added.
    expect(result.current.form.getFieldState("spec.model_routes").invalid).toBe(
      false,
    );
  });

  it.each([
    {
      name: "duplicate channel names",
      spec: {
        upstreams: [
          makeUpstream({ name: "same" }),
          makeUpstream({ name: "same" }),
        ],
        model_routes: [
          makeRoute({ targets: [makeTarget({ upstream: "same" })] }),
        ],
      },
      error: "external_endpoints.validation.duplicateProvider",
    },
    {
      name: "a blank channel name",
      spec: { upstreams: [makeUpstream({ name: " " })], model_routes: [] },
      error: "external_endpoints.validation.duplicateProvider",
    },
    {
      name: "an unnamed model",
      spec: { model_routes: [makeRoute({ model: " " })] },
      error: "external_endpoints.validation.virtualModelRequired",
    },
    {
      name: "a target on an unknown channel",
      spec: {
        model_routes: [
          makeRoute({ targets: [makeTarget({ upstream: "gone" })] }),
        ],
      },
      error: "external_endpoints.validation.routeTargetRequired",
    },
  ])("rejects $name", async ({ spec, error }) => {
    const result = await finishWith({ upstreams: [makeUpstream()], ...spec });

    expect(refineForm.onFinish).not.toHaveBeenCalled();
    expect(
      result.current.form.getFieldState("spec.model_routes").error?.message,
    ).toBe(error);
  });

  it.each([undefined, null])(
    "saves a route with strategy %s as fixed, weighting its target 1",
    async (strategy) => {
      const target = makeTarget({ max_inflight_requests: 2 });
      await finishWith({
        upstreams: [makeUpstream()],
        model_routes: [
          makeRoute({ strategy, targets: [{ ...target, weight: undefined }] }),
        ],
      });

      expect(submitted().model_routes).toEqual([
        makeRoute({ strategy: "fixed", targets: [target] }),
      ]);
    },
  );

  it.each([
    { name: "legacy", modelRoutes: undefined, models: ["chat", "embedding"] },
    { name: "deleted", modelRoutes: [], models: [] },
  ])(
    "migrates legacy mappings without restoring explicit deletions ($name)",
    async ({ modelRoutes, models }) => {
      await finishWith({
        upstreams: [
          makeUpstream({ name: "a", model_mapping: { chat: "actual-chat" } }),
          makeUpstream({
            name: "b",
            model_mapping: { embedding: "actual-embedding" },
          }),
        ],
        model_routes: modelRoutes,
      });

      expect(submitted().upstreams.map((u) => u.model_mapping)).toEqual([
        {},
        {},
      ]);
      expect(submitted().model_routes?.map((route) => route.model)).toEqual(
        models,
      );
    },
  );
});

describe("loading a saved endpoint", () => {
  it.each([
    { strategy: "fixed" as const, priorities: [0], locked: false, tiers: [0] },
    {
      strategy: "weighted" as const,
      priorities: [0, 0],
      locked: true,
      tiers: [0, 0],
    },
    {
      strategy: "priority" as const,
      priorities: [1, 2, 3],
      locked: true,
      tiers: [0, 1, 1],
    },
    {
      strategy: "priority" as const,
      priorities: [20, 10, 10],
      locked: true,
      tiers: [1, 0, 0],
    },
  ])(
    "loads $strategy priorities $priorities as tiers $tiers, locked: $locked",
    ({ strategy, priorities, locked, tiers }) => {
      renderHook(() => useExternalEndpointForm({ action: "edit" }));
      const route = makeRoute({
        strategy,
        targets: priorities.map((priority) => makeTarget({ priority })),
      });

      const [loaded] =
        selectRecord(makeExternalEndpoint({ model_routes: [route] })).spec
          .model_routes ?? [];

      expect(loaded).toMatchObject({ strategyLocked: locked });
      expect(loaded.targets.map((t) => t.priority)).toEqual(tiers);
    },
  );

  it("shows priority tiers and saves them without reordering targets", async () => {
    const targets = [20, 10, 10].map((priority, index) =>
      makeTarget({
        upstream_model: `model-${index}`,
        priority,
        max_inflight_requests: 5,
      }),
    );
    const view = renderEndpointForm({
      spec: routesSpec(makeRoute({ strategy: "priority", targets })),
    });

    expect(
      within(table("primaryTargets")).getAllByRole("spinbutton"),
    ).toHaveLength(2);
    expect(
      within(table("fallbackTargets")).getAllByRole("spinbutton"),
    ).toHaveLength(1);
    await submit(view);
    expect(submitted().model_routes?.[0].targets).toEqual(
      targets.map((t) => ({ ...t, priority: t.priority === 10 ? 0 : 1 })),
    );
  });
});

// The editor's own behavior is owned by ModelRouteEditor.test.tsx.
describe("route editor wiring", () => {
  it("blocks submission until the edited weights total 100, then saves them", async () => {
    const route = makeRoute({
      strategy: "weighted",
      targets: [
        makeTarget({ upstream: "a", weight: 5 }),
        makeTarget({ upstream: "b", weight: 5 }),
      ],
    });
    const view = renderEndpointForm({ spec: routesSpec(route) });
    expect(view.result.current.submitBlocked).toBe(true);

    change(field("weightRatio")[0], "95");
    expect(view.result.current.submitBlocked).toBe(false);
    await submit(view);

    // Saved without the form-only strategy lock.
    expect(submitted().model_routes).toEqual([
      {
        ...route,
        targets: [{ ...route.targets[0], weight: 95 }, route.targets[1]],
      },
    ]);
  });
});
