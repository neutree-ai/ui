import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/api", () => ({
  REST_URL: "http://localhost/api/v1",
}));

const { getRayDashboardProxy } = await import("./get-ray-dashboard-proxy");

describe("getRayDashboardProxy", () => {
  it("returns proxy URL when dashboard_url exists", () => {
    const cluster = {
      metadata: { name: "my-cluster", workspace: "prod" },
      status: { dashboard_url: "http://ray:8265" },
    };
    expect(getRayDashboardProxy(cluster)).toBe(
      "http://localhost/api/v1/ray-dashboard-proxy/prod/my-cluster/",
    );
  });

  it("returns null when no dashboard_url", () => {
    const cluster = {
      metadata: { name: "my-cluster", workspace: "prod" },
      status: { dashboard_url: null },
    };
    expect(getRayDashboardProxy(cluster)).toBeNull();
  });

  it("returns null when no status", () => {
    const cluster = {
      metadata: { name: "my-cluster", workspace: "prod" },
    };
    expect(getRayDashboardProxy(cluster)).toBeNull();
  });

  it("returns null when cluster is undefined", () => {
    expect(getRayDashboardProxy(undefined)).toBeNull();
  });
});
