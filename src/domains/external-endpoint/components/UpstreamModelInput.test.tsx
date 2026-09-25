import { type DataProvider, Refine } from "@refinedev/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import UpstreamModelInput, {
  UpstreamConnectionWarning,
} from "./UpstreamModelInput";

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
const open = () => fireEvent.click(screen.getByRole("combobox"));
function ControlledInput({
  onChange,
  request,
}: {
  onChange: (value: string) => void;
  request?: { endpoint_ref: string; workspace: string };
}) {
  const [value, setValue] = useState("manual-model");
  return (
    <UpstreamModelInput
      value={value}
      request={request}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}
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
      <UpstreamConnectionWarning request={payload} />
      <ControlledInput onChange={onChange} request={payload} />
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
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Model-B" },
    });
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
      await waitFor(() => expect(screen.queryByText("loading")).toBeNull());
      expect(screen.getByRole("listbox").textContent).toBe("");
      if (scenario === "empty") {
        expect(
          screen.queryByRole("button", {
            name: "external_endpoints.messages.upstreamConnectionFailed",
          }),
        ).toBeNull();
      } else {
        expect(
          screen.getByRole("button", {
            name: "external_endpoints.messages.upstreamConnectionFailed",
          }),
        ).toBeTruthy();
      }
      fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
      fireEvent.change(
        screen.getByRole("combobox", {
          name: "external_endpoints.fields.upstreamModelName",
        }),
        { target: { value: "private-model" } },
      );
      expect(onChange).toHaveBeenCalledWith("private-model");
    },
  );

  it("retains custom text on Enter and blur without selecting the first suggestion", async () => {
    setup();
    open();
    await screen.findByRole("option", { name: "model-a" });
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "model" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect((input as HTMLInputElement).value).toBe("model");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    fireEvent.change(input, { target: { value: "private-model" } });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe("private-model");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("supports keyboard selection and shows all models again when reopened", async () => {
    setup();
    open();
    await screen.findByRole("option", { name: "org/Model-B" });
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Model-B" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect((input as HTMLInputElement).value).toBe("org/Model-B");
    open();
    await screen.findByRole("option", { name: "model-a" });
  });

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

  it("clears a channel warning when its connection settings change or a retry succeeds", async () => {
    const custom = vi
      .fn()
      .mockResolvedValueOnce({ data: { success: false } })
      .mockResolvedValue(result(["healthy-model"]));
    const { rerender, ui } = setup(custom);
    open();
    await screen.findByRole("button", {
      name: "external_endpoints.messages.upstreamConnectionFailed",
    });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    open();
    await screen.findByRole("option", { name: "healthy-model" });
    expect(
      screen.queryByRole("button", {
        name: "external_endpoints.messages.upstreamConnectionFailed",
      }),
    ).toBeNull();
    custom.mockResolvedValue({ data: { success: false } });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    open();
    await screen.findByRole("button", {
      name: "external_endpoints.messages.upstreamConnectionFailed",
    });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    rerender(ui({ endpoint_ref: "new-channel", workspace: "default" }));
    expect(
      screen.queryByRole("button", {
        name: "external_endpoints.messages.upstreamConnectionFailed",
      }),
    ).toBeNull();
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
    expect(screen.queryByRole("button")).toBeNull();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "manual" },
    });
    expect(onChange).toHaveBeenCalledWith("manual");
    expect(custom).not.toHaveBeenCalled();
  });
});
