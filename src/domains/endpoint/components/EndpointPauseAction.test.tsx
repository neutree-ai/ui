import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, expect, it, vi } from "vitest";
import { makeEndpoint } from "@/domains/endpoint/testing/builders";
import { EndpointPauseAction } from "./EndpointPauseAction";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useUpdate: () => ({ mutateAsync: mocks.mutateAsync, isLoading: false }),
  useInvalidate: () => mocks.invalidate,
}));

vi.mock("@/foundation/components/Table", () => ({
  RowAction: ({
    title,
    onClick,
    disabled,
  }: {
    title: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {title}
    </button>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  mocks.mutateAsync.mockReset();
  mocks.invalidate.mockReset().mockResolvedValue(undefined);
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

it("shows a localized cache error when resuming fails with a cache admission code", async () => {
  mocks.mutateAsync.mockRejectedValue({
    code: "21102",
    message:
      "wait for the cluster cache node pool to finish applying before enabling inference cache",
  });
  const paused = makeEndpoint({
    metadata: { labels: { "neutree.ai/paused": "true" } },
    spec: { replicas: { num: 0 } },
  });

  render(<EndpointPauseAction endpoint={paused} />);
  fireEvent.click(
    screen.getByRole("button", { name: "endpoints.actions.resume" }),
  );

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(
      "endpoints.kvCacheSettings.errors.nodePoolNotReady:",
    ),
  );
});

it("falls back to the server message for uncoded resume errors", async () => {
  mocks.mutateAsync.mockRejectedValue(new Error("upstream gateway timeout"));
  const paused = makeEndpoint({
    metadata: { labels: { "neutree.ai/paused": "true" } },
    spec: { replicas: { num: 0 } },
  });

  render(<EndpointPauseAction endpoint={paused} />);
  fireEvent.click(
    screen.getByRole("button", { name: "endpoints.actions.resume" }),
  );

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("upstream gateway timeout"),
  );
});
