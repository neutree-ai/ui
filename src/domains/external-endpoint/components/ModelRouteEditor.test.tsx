import { fireEvent, render, screen, within } from "@testing-library/react";
import { type ComponentProps, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { pickOption } from "@/foundation/testing/interactions";
import type { EditableModelRoute } from "../lib/route-strategy";
import { makeRoute, makeTarget } from "../testing/fixtures";
import ModelRouteEditor from "./ModelRouteEditor";

// The target model picker queries its channel; these providers have none.
vi.mock("@refinedev/core", () => ({
  useCustom: () => ({ data: undefined, isFetching: false, isError: false }),
}));

const providers = [
  { label: "a", value: "a" },
  { label: "b", value: "b" },
];

/** Renders the editor controlled, the way the form drives it. */
function renderEditor(
  initial: EditableModelRoute[],
  props: Partial<ComponentProps<typeof ModelRouteEditor>> = {},
) {
  const onChange = vi.fn();
  function Harness() {
    const form = useForm();
    const [value, setValue] = useState(initial);
    return (
      <FormProvider {...form}>
        <ModelRouteEditor
          providers={providers}
          {...props}
          value={value}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      </FormProvider>
    );
  }
  render(<Harness />);
  return {
    onChange,
    routes: () => onChange.mock.lastCall?.[0] as EditableModelRoute[],
  };
}

const field = (key: string) =>
  screen.getAllByLabelText(`external_endpoints.fields.${key}`) as (
    | HTMLInputElement
    | HTMLButtonElement
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
const switchMode = (mode: string, index = 0) =>
  pickOption(
    field("routingMode")[index],
    `external_endpoints.options.${mode}Routing`,
  );
const priorityRoute = (...targets: ReturnType<typeof makeTarget>[]) =>
  makeRoute({ strategy: "priority", targets });

describe("route", () => {
  it("titles the route with its model name", () => {
    renderEditor([makeRoute({ model: "" })]);
    screen.getByRole("heading", {
      name: "external_endpoints.sections.routeConfiguration:external_endpoints.messages.unnamedModel",
    });

    change(field("virtualModelName")[0], "renamed");

    screen.getByRole("heading", {
      name: "external_endpoints.sections.routeConfiguration:renamed",
    });
  });

  it("adds an unlocked fixed route on the first channel and removes routes by position", () => {
    const locked = {
      ...makeRoute({ model: "saved", strategy: "weighted" }),
      strategyLocked: true,
    };
    const { routes } = renderEditor([makeRoute({ model: "first" }), locked]);

    clickAction("addVirtualModel");
    expect(routes()[2]).toEqual({
      model: "",
      strategy: "fixed",
      targets: [{ upstream: "a", upstream_model: "" }],
    });
    switchMode("priority", 2);
    clickAction("removeVirtualModel", 0);

    expect(routes().map((route) => route.strategy)).toEqual([
      "weighted",
      "priority",
    ]);
    expect(field("routingMode")[0]).toHaveProperty("disabled", true);
  });

  it("focuses the model named by focusModel", () => {
    renderEditor([makeRoute({ model: "one" }), makeRoute({ model: "two" })], {
      focusModel: "two",
    });

    expect(document.activeElement).toBe(screen.getByDisplayValue("two"));
  });
});

describe("targets", () => {
  it("picks a target's channel and leaves quick-create to the parent", () => {
    const onQuickCreate = vi.fn();
    const { routes } = renderEditor(
      [priorityRoute(makeTarget(), makeTarget({ priority: 1 }))],
      { onQuickCreate },
    );

    pickOption(field("provider")[0], "b");
    expect(routes()[0].targets[0].upstream).toBe("b");
    pickOption(
      field("provider")[1],
      "+ external_endpoints.actions.quickCreateUpstream",
    );

    expect(onQuickCreate).toHaveBeenCalledWith(0, 1);
    expect(routes()[0].targets[1].upstream).toBe("a");
  });

  it.each([
    { strategy: "fixed" as const, limits: [2] },
    { strategy: "priority" as const, limits: [2, 8] },
  ])(
    "edits each $strategy target's concurrent limit",
    ({ strategy, limits }) => {
      const route = makeRoute({
        strategy,
        targets: limits.map((limit, index) =>
          makeTarget({ priority: index, max_inflight_requests: limit }),
        ),
      });
      const { routes } = renderEditor([route]);
      const inputs = field("maxInflightRequests") as HTMLInputElement[];
      expect(inputs.map((input) => input.value)).toEqual(limits.map(String));

      for (const [index, input] of inputs.entries())
        change(input, String(index + 4));

      expect(routes()[0].targets).toEqual(
        route.targets.map((target, index) => ({
          ...target,
          max_inflight_requests: index + 4,
        })),
      );
    },
  );

  it.each([
    { strategy: "fixed", target: 0, value: "", valid: true },
    { strategy: "fixed", target: 0, value: "0", valid: true },
    { strategy: "fixed", target: 0, value: "-1", valid: false },
    { strategy: "fixed", target: 0, value: "1.5", valid: false },
    { strategy: "fixed", target: 0, value: "2147483648", valid: false },
    { strategy: "priority", target: 0, value: "", valid: false },
    { strategy: "priority", target: 0, value: "0", valid: false },
    { strategy: "priority", target: 1, value: "", valid: true },
  ] as const)(
    "$strategy target $target, limit $value -> valid: $valid",
    ({ strategy, target, value, valid }) => {
      const { routes } = renderEditor([
        makeRoute({
          strategy,
          targets: [0, 1].map((priority) =>
            makeTarget({ priority, max_inflight_requests: 3 }),
          ),
        }),
      ]);
      const input = field("maxInflightRequests")[target] as HTMLInputElement;

      change(input, value);

      expect(input.checkValidity()).toBe(valid);
      expect(routes()[0].targets[target].max_inflight_requests).toBe(
        value === "" ? undefined : Number(value),
      );
    },
  );

  it("offers no target removal on a fixed route", () => {
    renderEditor([makeRoute()]);

    expect(
      screen.queryByRole("button", {
        name: "external_endpoints.actions.removeTarget",
      }),
    ).toBeNull();
  });

  it("adds primary and fallback targets to their tiers", () => {
    const { routes } = renderEditor([priorityRoute(makeTarget())]);
    screen.getByText("external_endpoints.messages.noFallbackTargets");

    clickAction("addPrimaryTarget");
    clickAction("addFallbackTarget");
    clickAction("addFallbackTarget");

    expect(routes()[0].targets.map((target) => target.priority)).toEqual([
      0, 0, 1, 1,
    ]);
    expect(
      within(table("primaryTargets")).getAllByRole("spinbutton"),
    ).toHaveLength(2);
    expect(
      within(table("fallbackTargets")).getAllByRole("spinbutton"),
    ).toHaveLength(2);
  });

  it("keeps the last primary target but removes a fallback", () => {
    const { routes } = renderEditor([
      priorityRoute(makeTarget(), makeTarget({ upstream: "b", priority: 1 })),
    ]);
    const remove = (name: "primaryTargets" | "fallbackTargets") =>
      within(table(name)).getByRole("button", {
        name: "external_endpoints.actions.removeTarget",
      });
    expect(remove("primaryTargets")).toHaveProperty("disabled", true);

    fireEvent.click(remove("fallbackTargets"));

    expect(routes()[0].targets).toEqual([makeTarget()]);
  });
});

describe("weighted targets", () => {
  const weighted = () =>
    makeRoute({
      strategy: "weighted",
      targets: [
        makeTarget({ upstream: "a", weight: 5, max_inflight_requests: 2 }),
        makeTarget({ upstream: "b", weight: 5, max_inflight_requests: 8 }),
      ],
    });

  it("reports the weight total as weights change", () => {
    const { routes } = renderEditor([weighted()]);
    const total = () => screen.getByRole("status").textContent;
    expect(total()).toBe("external_endpoints.messages.weightTotalInvalid:10");
    expect(field("weightRatio")[0].getAttribute("aria-invalid")).toBe("true");

    change(field("weightRatio")[0], "95");
    expect(total()).toBe("external_endpoints.messages.weightTotalValid:100");
    change(field("weightRatio")[1], "");

    expect(routes()[0].targets[1].weight).toBeUndefined();
  });

  it("hides capacity but keeps it when a target's model changes", () => {
    const route = weighted();
    const { routes } = renderEditor([route]);
    expect(
      screen.queryByLabelText("external_endpoints.fields.maxInflightRequests"),
    ).toBeNull();

    change(field("upstreamModelName")[0], "updated");

    expect(routes()[0].targets).toEqual([
      { ...route.targets[0], upstream_model: "updated" },
      route.targets[1],
    ]);
  });

  it("adds a weighted target", () => {
    renderEditor([weighted()]);

    clickAction("addWeightedTarget");

    expect(field("weightRatio")).toHaveLength(3);
  });
});

describe("routing strategy", () => {
  it("switches an unconfigured route without asking", () => {
    const { routes } = renderEditor([makeRoute()]);

    for (const mode of ["priority", "weighted", "fixed", "weighted"]) {
      switchMode(mode);
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(field("upstreamModelName")).toHaveLength(mode === "fixed" ? 1 : 2);
    }

    expect(routes()[0].strategy).toBe("weighted");
  });

  it("asks before a lossy switch and applies it only when confirmed", () => {
    const { onChange, routes } = renderEditor([
      priorityRoute(
        makeTarget({ max_inflight_requests: 7 }),
        makeTarget({ upstream: "b", upstream_model: "standby", priority: 1 }),
      ),
    ]);

    switchMode("weighted");
    within(screen.getByRole("alertdialog")).getByText(
      "external_endpoints.messages.changeStrategyTitle",
    );
    fireEvent.click(screen.getByRole("button", { name: "buttons.cancel" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(field("maxInflightRequests")[0].value).toBe("7");

    switchMode("weighted");
    clickAction("changeStrategy");

    expect(routes()[0].strategy).toBe("weighted");
    expect(field("weightRatio")).toHaveLength(2);
  });
});
