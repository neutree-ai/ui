import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Endpoint, EndpointClusterRef } from "../types";
import { EndpointKVCacheSummary } from "./EndpointKVCacheSummary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { seconds: number }) =>
      values ? `${values.seconds} s` : key,
  }),
}));
afterEach(cleanup);
describe("EndpointKVCacheSummary", () => {
  it.each([
    [true, true],
    [false, true],
    [false, false],
  ])("renders enabled=%s configured=%s", (enabled, configured) => {
    const endpoint = {
      metadata: { workspace: "default" },
      spec: {
        kv_cache: enabled
          ? { provider: "zcache", options: { timeout_seconds: 2 } }
          : null,
      },
    } as Endpoint;
    const cluster = {
      metadata: { name: "gpu-cluster" },
      spec: { cache: { provider: "zcache", options: { enabled: configured } } },
    } as unknown as EndpointClusterRef;
    render(
      <MemoryRouter>
        <EndpointKVCacheSummary endpoint={endpoint} cluster={cluster} />
      </MemoryRouter>,
    );
    const toggle = screen.getByRole("switch") as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute("aria-checked")).toBe(String(enabled));
    expect(Boolean(screen.queryByText("2 s"))).toBe(enabled);
    const link = screen.queryByRole("link");
    expect(Boolean(link)).toBe(configured);
    if (link)
      expect(link.getAttribute("href")).toBe(
        "/default/clusters/show/gpu-cluster?section=cache",
      );
    expect(
      Boolean(
        screen.queryByText("endpoints.kvCacheSettings.clusterUnconfigured"),
      ),
    ).toBe(!configured);
  });
});
