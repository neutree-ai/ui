import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Cluster } from "@/domains/cluster/types";
import type { Endpoint } from "../types";
import { EndpointZCacheSummary } from "./EndpointZCacheSummary";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, values?: { seconds: number }) => values ? `${values.seconds} s` : key }) }));
afterEach(cleanup);
describe("EndpointZCacheSummary", () => {
  it.each([[true, true], [false, true], [false, false]])("renders enabled=%s configured=%s", (enabled, configured) => {
    const endpoint = { metadata: { workspace: "default" }, spec: { zcache: { enabled, timeout_seconds: 2 } } } as Endpoint;
    const cluster = { metadata: { name: "gpu-cluster" }, spec: { zcache: { enabled: configured } } } as Cluster;
    render(<MemoryRouter><EndpointZCacheSummary endpoint={endpoint} cluster={cluster} /></MemoryRouter>);
    const toggle = screen.getByRole("switch") as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute("aria-checked")).toBe(String(enabled));
    expect(Boolean(screen.queryByText("2 s"))).toBe(enabled);
    const link = screen.queryByRole("link");
    expect(Boolean(link)).toBe(configured);
    if (link) expect(link.getAttribute("href")).toBe("/default/clusters/show/gpu-cluster?section=zcache");
    expect(Boolean(screen.queryByText("endpoints.zcache.clusterUnconfigured"))).toBe(!configured);
  });
});
