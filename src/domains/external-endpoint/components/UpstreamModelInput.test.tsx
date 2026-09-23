import { type DataProvider, Refine } from "@refinedev/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import UpstreamModelInput from "./UpstreamModelInput";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);
const request = { endpoint_ref: "first", workspace: "default" };
const result = (models: string[]) => ({ data: { success: true, models } });
const open = () =>
  fireEvent.click(
    screen.getByRole("button", {
      name: "external_endpoints.actions.selectUpstreamModel",
    }),
  );
function setup(
  custom = vi
    .fn()
    .mockResolvedValue(result(["model-a", "org/Model-B", "model-a"])),
) {
  const onChange = vi.fn();
  const provider = { getApiUrl: () => "", custom } as unknown as DataProvider;
  const ui = (payload: typeof request | undefined = request) => (
    <Refine
      dataProvider={{ default: provider }}
      options={{ disableTelemetry: true }}
    >
      <UpstreamModelInput
        value="manual-model"
        onChange={onChange}
        request={payload}
      />
    </Refine>
  );
  return { ...render(ui()), custom, onChange, ui };
}
describe("upstream model selection", () => {
  it("loads on opening, searches, deduplicates and selects the exact model id", async () => {
    const { custom, onChange } = setup();
    expect(custom).not.toHaveBeenCalled();
    open();
    await screen.findByRole("option", { name: "org/Model-B" });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(custom).toHaveBeenCalledWith(
      expect.objectContaining({ method: "post", payload: request }),
    );
    fireEvent.change(
      screen.getByPlaceholderText(
        "external_endpoints.placeholders.searchUpstreamModels",
      ),
      { target: { value: "Model-B" } },
    );
    expect(screen.queryByRole("option", { name: "model-a" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "org/Model-B" }));
    expect(onChange).toHaveBeenCalledWith("org/Model-B");
    expect(screen.queryByRole("option")).toBeNull();
  });

  it.each(["empty", "upstream error", "request error"])(
    "allows manual input after %s",
    async (scenario) => {
      const custom =
        scenario === "request error"
          ? vi.fn().mockRejectedValue(new Error("offline"))
          : vi
              .fn()
              .mockResolvedValue(
                scenario === "empty"
                  ? result([])
                  : { data: { success: false, error: "unavailable" } },
              );
      const { onChange } = setup(custom);
      open();
      await screen.findByText(
        scenario === "empty"
          ? "external_endpoints.messages.noModelSuggestions"
          : "external_endpoints.messages.modelListFailed",
      );
      fireEvent.keyDown(
        screen.getByPlaceholderText(
          "external_endpoints.placeholders.searchUpstreamModels",
        ),
        { key: "Escape" },
      );
      fireEvent.change(
        screen.getByRole("textbox", {
          name: "external_endpoints.fields.upstreamModelName",
        }),
        { target: { value: "private-model" } },
      );
      expect(onChange).toHaveBeenCalledWith("private-model");
    },
  );

  it("does not replace the new channel's models with an older request", async () => {
    let resolveFirst!: (value: ReturnType<typeof result>) => void;
    const custom = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(result(["second-model"]));
    const { rerender, ui } = setup(custom);
    open();
    await waitFor(() => expect(custom).toHaveBeenCalledTimes(1));
    rerender(ui({ endpoint_ref: "second", workspace: "default" }));
    await screen.findByRole("option", { name: "second-model" });
    await act(async () => resolveFirst(result(["stale-first-model"])));
    expect(
      screen.queryByRole("option", { name: "stale-first-model" }),
    ).toBeNull();
    expect(screen.getByRole("option", { name: "second-model" })).toBeTruthy();
  });

  it("keeps manual input usable without a configured upstream", () => {
    const { rerender, custom, onChange } = setup();
    // Explicitly remove the request, rather than accepting the helper default.
    const provider = { getApiUrl: () => "", custom } as unknown as DataProvider;
    rerender(
      <Refine
        dataProvider={{ default: provider }}
        options={{ disableTelemetry: true }}
      >
        <UpstreamModelInput value="" onChange={onChange} />
      </Refine>,
    );
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "manual" },
    });
    expect(onChange).toHaveBeenCalledWith("manual");
    expect(custom).not.toHaveBeenCalled();
  });
});
