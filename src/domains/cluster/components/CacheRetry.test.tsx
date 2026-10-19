import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Cluster } from "../types";
import { CacheRetry } from "./CacheRetry";

const mocks = vi.hoisted(() => ({ update: vi.fn(), can: true }));
vi.mock("@refinedev/core", () => ({
  useCan: () => ({ data: { can: mocks.can } }),
  useUpdate: () => ({ mutateAsync: mocks.update, isLoading: false }),
  useInvalidate: () => vi.fn().mockResolvedValue(undefined),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const cluster = {
  metadata: {
    name: "test",
    workspace: "default",
    annotations: { keep: "yes" },
  },
  spec: { cache: { provider: "zcache", options: { enabled: false } } },
} as unknown as Cluster;
beforeEach(() => {
  mocks.update.mockReset().mockResolvedValue({});
  mocks.can = true;
});
it("retries without submitting configuration or requiring a node selection", async () => {
  render(<CacheRetry cluster={cluster} />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  const payload = mocks.update.mock.calls[0][0].values;
  expect(payload).not.toHaveProperty("spec");
  expect(payload).not.toHaveProperty("status");
  expect(payload.metadata.annotations.keep).toBe("yes");
  expect(payload.metadata.annotations["neutree.ai/zcache-retry"]).toMatch(
    /^[0-9a-f-]{36}$/,
  );
});
it("does not allow read-only users to retry", () => {
  mocks.can = false;
  render(<CacheRetry cluster={cluster} />);
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
});
it("keeps a failed retry visible", async () => {
  mocks.update.mockRejectedValue(new Error("ZCache unavailable"));
  render(<CacheRetry cluster={cluster} />);
  fireEvent.click(screen.getByRole("button"));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).toBe(
    "clusters.zcache.serviceName unavailable",
  );
});
