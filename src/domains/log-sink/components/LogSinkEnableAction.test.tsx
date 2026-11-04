import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeLogSink } from "@/domains/log-sink/testing/builders";

const mutate = vi.hoisted(() => vi.fn());

vi.mock("@refinedev/core", () => ({
  useUpdate: () => ({ mutate, isLoading: false }),
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
    mutate.mockReset();
  });

  it.each([
    { enabled: true, label: "log_sinks.actions.disable", next: false },
    { enabled: undefined, label: "log_sinks.actions.disable", next: false },
    { enabled: false, label: "log_sinks.actions.enable", next: true },
  ])(
    "toggles enabled=$enabled to $next and resends the whole spec",
    ({ enabled, label, next }) => {
      render(<LogSinkEnableAction sink={sink(enabled)} />);
      fireEvent.click(screen.getByText(label));

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "ext-a",
          values: {
            spec: {
              type: "victorialogs",
              enabled: next,
              victorialogs: { url: "https://vl:9428" },
            },
          },
        }),
      );
    },
  );
});
