import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeEndpoint } from "@/domains/endpoint/testing/builders";
import { EndpointPauseAction } from "./EndpointPauseAction";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useUpdate: () => ({ mutateAsync: mocks.update, isLoading: false }),
  useInvalidate: () => mocks.invalidate,
}));

vi.mock("@/foundation/components/Table", () => ({
  RowAction: ({ onClick, title }: { onClick: () => void; title: string }) => (
    <button type="button" onClick={onClick}>
      {title}
    </button>
  ),
}));

describe("EndpointPauseAction write payload", () => {
  beforeEach(() => {
    mocks.update.mockReset().mockResolvedValue({});
    mocks.invalidate.mockReset().mockResolvedValue(undefined);
  });

  it.each([
    {
      action: "pause",
      count: 3,
      next: 0,
      labels: { team: "inference" },
      nextLabels: { team: "inference", "neutree.ai/last_replicas": "3" },
    },
    {
      action: "resume",
      count: 0,
      next: 3,
      labels: { team: "inference", "neutree.ai/last_replicas": "3" },
      nextLabels: { team: "inference" },
    },
  ])(
    "$action sends the complete record with only replicas and labels changed",
    async ({ action, count, next, labels, nextLabels }) => {
      const endpoint = makeEndpoint({
        metadata: {
          labels: labels as Record<string, string>,
          annotations: { owner: "operator" },
        },
        spec: { replicas: { num: count } },
      });
      render(<EndpointPauseAction endpoint={endpoint} />);

      fireEvent.click(
        screen.getByRole("button", { name: `endpoints.actions.${action}` }),
      );

      await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
      expect(mocks.update).toHaveBeenCalledWith({
        resource: "endpoints",
        id: "chat",
        values: {
          ...endpoint,
          metadata: { ...endpoint.metadata, labels: nextLabels },
          spec: { ...endpoint.spec, replicas: { num: next } },
        },
        mutationMode: "pessimistic",
        meta: {
          idColumnName: "metadata->name",
          workspace: "default",
          workspaced: true,
        },
        successNotification: false,
        errorNotification: false,
      });
      expect(endpoint.spec.replicas?.num).toBe(count);
    },
  );
});
