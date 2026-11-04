import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLogSink } from "@/domains/log-sink/testing/builders";

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useInvalidate: () => mocks.invalidate,
  useUpdate: () => ({ mutateAsync: mocks.mutateAsync, isLoading: false }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/foundation/components/Table", () => ({
  RowAction: ({ title, onClick }: { title: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {title}
    </button>
  ),
}));

import { LogSinkEnableAction } from "./LogSinkEnableAction";

const sink = (enabled?: boolean) =>
  makeLogSink({ name: "ext-a", spec: { enabled } });

describe("LogSinkEnableAction", () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset().mockResolvedValue({});
    mocks.invalidate.mockReset();
  });

  it.each([
    { enabled: true, label: "log_sinks.actions.disable", next: false },
    { enabled: undefined, label: "log_sinks.actions.disable", next: false },
    { enabled: false, label: "log_sinks.actions.enable", next: true },
  ])(
    "toggles enabled=$enabled to $next and resends the whole spec",
    async ({ enabled, label, next }) => {
      render(<LogSinkEnableAction sink={sink(enabled)} />);
      fireEvent.click(screen.getByText(label));

      await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
      const call = mocks.mutateAsync.mock.calls[0][0];
      expect(call.id).toBe("ext-a");
      expect(call.values).toEqual({
        spec: {
          type: "victorialogs",
          enabled: next,
          victorialogs: { url: "https://vl:9428" },
        },
      });
      await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
    },
  );
});
