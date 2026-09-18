import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ModelRoute } from "@/domains/external-endpoint/types";
import ModelRouteDetails from "./ModelRouteDetails";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
}));

describe("ModelRouteDetails", () => {
  it("keeps relative weights and concurrent request limits in separate columns", () => {
    render(
      <ModelRouteDetails
        editUrl="/edit"
        route={{
          model: "weighted",
          strategy: "weighted",
          targets: [
            {
              upstream: "a",
              upstream_model: "gpt-6-astra",
              weight: 5,
              max_inflight_requests: 2,
            },
            { upstream: "b", upstream_model: "gpt-5.6", weight: 5 },
          ],
        }}
      />,
      { wrapper: MemoryRouter },
    );
    expect(
      screen.getAllByRole("columnheader").map((cell) => cell.textContent),
    ).toEqual([
      "external_endpoints.fields.provider",
      "external_endpoints.fields.upstreamModelName",
      "external_endpoints.fields.weight",
      "external_endpoints.fields.maxInflightRequests",
    ]);
    const rows = screen.getAllByRole("row").slice(1);
    expect(
      within(rows[0])
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["a", "gpt-6-astra", "5", "2"]);
    expect(
      within(rows[1])
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["b", "gpt-5.6", "5", "external_endpoints.fields.unlimited"]);
  });

  it("identifies the primary tier by priority instead of array order", () => {
    render(
      <ModelRouteDetails
        editUrl="/edit"
        route={{
          model: "priority",
          strategy: "priority",
          targets: [
            { upstream: "backup", upstream_model: "b", priority: 20 },
            { upstream: "primary-a", upstream_model: "a", priority: 10 },
            { upstream: "primary-b", upstream_model: "b", priority: 10 },
          ],
        }}
      />,
      { wrapper: MemoryRouter },
    );
    expect(
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[2].textContent),
    ).toEqual([
      "external_endpoints.options.fallbackRole",
      "external_endpoints.options.primaryRole",
      "external_endpoints.options.primaryRole",
    ]);
  });

  it("uses strategy even for one target and defaults missing strategy to fixed", () => {
    const targets = [{ upstream: "a", upstream_model: "a", priority: 10 }];
    const { rerender } = render(
      <ModelRouteDetails
        editUrl="/edit"
        route={{ model: "single", strategy: "weighted", targets }}
      />,
      { wrapper: MemoryRouter },
    );
    expect(
      screen.queryByText("external_endpoints.options.weightedRouting"),
    ).not.toBeNull();
    rerender(
      <ModelRouteDetails
        editUrl="/edit"
        route={{ model: "legacy", targets } as ModelRoute}
      />,
    );
    expect(
      screen.queryByText("external_endpoints.options.fixedRouting"),
    ).not.toBeNull();
    expect(
      screen.queryByRole("columnheader", {
        name: "external_endpoints.fields.role",
      }),
    ).toBeNull();
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
    expect(dialog.querySelector("code")?.textContent).toContain(
      "ENDPOINT_API_KEY",
    );
    expect(dialog.querySelector("pre")?.textContent).toContain(
      '"model": "test-model-v2"',
    );
    expect(dialog.querySelector("pre")?.textContent).not.toContain(
      "upstream-only",
    );
    fireEvent.mouseDown(
      within(dialog).getByRole("tab", {
        name: "external_endpoints.messages.curlExampleAnthropic",
      }),
      { button: 0, ctrlKey: false },
    );
    expect(dialog.querySelector("pre")?.textContent).toContain("/v1/messages");
    expect(dialog.querySelector("pre")?.textContent).toContain(
      '"model": "test-model-v2"',
    );
  });
});
