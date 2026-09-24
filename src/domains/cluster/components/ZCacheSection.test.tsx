import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Cluster } from "../types";
import { ZCacheSection } from "./ZCacheSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Section: ({ children }: { children: ReactNode }) => (
      <section>{children}</section>
    ),
    Row: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}));
vi.mock("@/foundation/components/Timestamp", () => ({
  default: ({ timestamp }: { timestamp: string }) => <span>{timestamp}</span>,
}));

describe("ZCacheSection", () => {
  it("does not label newly saved intent as applied using an old observation", () => {
    const cluster = {
      spec: { zcache: { enabled: true, l1_size_gib: 1, target_nodes: ["a"] } },
      status: {
        zcache: {
          phase: "Applied",
          current: { enabled: true, l1_size_gib: 8, target_nodes: ["a"] },
        },
      },
    } as unknown as Cluster;
    render(<ZCacheSection cluster={cluster} />);
    expect(screen.getByText("clusters.zcache.reconciling")).toBeTruthy();
  });

  it("shows rejected submission separately from current nodes and historical operations", () => {
    const cluster = {
      spec: { zcache: { enabled: true, l1_size_gib: 1, target_nodes: ["a"] } },
      status: {
        zcache: {
          phase: "Failed",
          message: "API 422",
          observed_at: "now",
          nodes: [{ name: "a", runtime: "Ready", capacity_bytes: 8 * 2 ** 30 }],
          change: { phase: "Rejected", message: "invalid capacity" },
          operations: [
            {
              id: "old-operation",
              phase: "Succeeded",
              kind: "install",
              nodes: [],
            },
          ],
        },
      },
    } as unknown as Cluster;
    render(<ZCacheSection cluster={cluster} />);
    expect(screen.getByText("clusters.zcache.failed")).toBeTruthy();
    expect(screen.getByText("a")).toBeTruthy();
    expect(screen.getByText("8 GiB")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("API 422");
    expect(screen.getByText(/clusters.zcache.notAccepted/)).toBeTruthy();
    expect(screen.getByText(/old-operation/)).toBeTruthy();
  });
});
