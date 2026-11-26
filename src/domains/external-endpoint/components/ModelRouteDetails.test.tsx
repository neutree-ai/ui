import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ModelRoute } from "@/domains/external-endpoint/types";
import ModelRouteDetails from "./ModelRouteDetails";

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
}));

const target = (
  upstream: string,
  overrides: Partial<ModelRoute["targets"][number]> = {},
) => ({ upstream, upstream_model: upstream, ...overrides });

const renderRoute = (route: Partial<ModelRoute>) =>
  render(
    <ModelRouteDetails
      editUrl="/edit"
      route={{ model: "route", targets: [target("a")], ...route } as ModelRoute}
    />,
    { wrapper: MemoryRouter },
  );

const columns = () =>
  screen.getAllByRole("columnheader").map((cell) => cell.textContent);

const cellsOf = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);

describe("ModelRouteDetails", () => {
  it("normalizes relative weights into percentages without a concurrency column", () => {
    renderRoute({
      strategy: "weighted",
      targets: [
        target("a", { weight: 5, max_inflight_requests: 2 }),
        target("b", { weight: 5 }),
      ],
    });
    // Weighted targets carry no concurrency limit, so printing "Unlimited"
    // would read as if one had been configured.
    expect(columns()).not.toContain(
      "external_endpoints.fields.maxInflightRequests",
    );
    const [first, second] = screen.getAllByRole("row").slice(1);
    expect(cellsOf(first)).toContain("50%");
    expect(cellsOf(second)).toContain("50%");
  });

  it("identifies the primary tier by priority instead of array order", () => {
    renderRoute({
      strategy: "priority",
      targets: [
        target("backup", { priority: 20, weight: 1 }),
        target("primary-a", { priority: 10, weight: 1 }),
        target("primary-b", { priority: 10, weight: 1 }),
      ],
    });
    expect(columns()).not.toContain("external_endpoints.fields.trafficWeight");
    const roleOf = (upstream: string) =>
      within(screen.getByRole("row", { name: new RegExp(`^${upstream}`) }))
        .getAllByRole("cell")[0]
        .textContent?.replace(upstream, "");
    expect(roleOf("backup")).toBe("external_endpoints.options.fallbackRole");
    expect(roleOf("primary-a")).toBe("external_endpoints.options.primaryRole");
    expect(roleOf("primary-b")).toBe("external_endpoints.options.primaryRole");
  });

  it("uses the strategy even for one target and defaults a missing one to fixed", () => {
    const { unmount } = renderRoute({ strategy: "weighted" });
    screen.getByText("external_endpoints.options.weightedRouting");
    unmount();

    renderRoute({ strategy: undefined });
    screen.getByText("external_endpoints.options.fixedRouting");
    expect(columns()).not.toContain("external_endpoints.fields.nodeRole");
  });

  it("hides persisted weights for fixed routes", () => {
    renderRoute({ strategy: "fixed", targets: [target("a", { weight: 1 })] });
    expect(columns()).not.toContain("external_endpoints.fields.trafficWeight");
    expect(columns()).toContain(
      "external_endpoints.fields.maxInflightRequests",
    );
  });

  it("opens call examples for the selected virtual model in a dialog", () => {
    render(
      ["test-model", "test-model-v2"].map((model) => (
        <ModelRouteDetails
          key={model}
          route={{
            model,
            strategy: "fixed",
            targets: [{ upstream: "a", upstream_model: "upstream-only" }],
          }}
          editUrl={`/edit?model=${model}`}
          serviceUrl="https://gateway.example/ee"
        />
      )),
      { wrapper: MemoryRouter },
    );
    expect(
      screen
        .getAllByRole("link", { name: "buttons.edit" })[1]
        .getAttribute("href"),
    ).toBe("/edit?model=test-model-v2");
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "external_endpoints.actions.testModel",
      })[1],
    );
    const dialog = screen.getByRole("dialog");
    const command = () => dialog.querySelector("pre")?.textContent;
    expect(command()).toContain('"model": "test-model-v2"');
    expect(command()).not.toContain("upstream-only");
    fireEvent.mouseDown(
      within(dialog).getByRole("tab", {
        name: "external_endpoints.messages.curlExampleAnthropic",
      }),
      { button: 0 },
    );
    expect(command()).toContain("/v1/messages");
    expect(command()).toContain('"model": "test-model-v2"');
  });
});
