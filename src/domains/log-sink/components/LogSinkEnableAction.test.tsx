import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LogSink } from "@/domains/log-sink/types";

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

const sink = (enabled?: boolean): LogSink =>
  ({
    id: 3,
    metadata: { name: "ext-a" },
    spec: {
      type: "victorialogs",
      enabled,
      victorialogs: { url: "http://vl", auth: { type: "bearer" } },
    },
  }) as unknown as LogSink;

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
          victorialogs: { url: "http://vl", auth: { type: "bearer" } },
        },
      });
      await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
    },
  );
});
