import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
  }),
}));

vi.mock("@/foundation/components/ShowButton", () => ({
  ShowButton: ({
    children,
    resource,
    recordItemId,
    meta,
  }: {
    children: ReactNode;
    resource: string;
    recordItemId: string;
    meta: { workspace: string };
  }) => (
    <a href={`#/${meta.workspace}/${resource}/${recordItemId}`}>{children}</a>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <div role="tooltip">{children}</div>
  ),
}));

import { buildCatalogOriginAnnotations } from "@/domains/endpoint/lib/catalog-origin";
import {
  EndpointCatalogOrigin,
  EndpointCatalogOriginLink,
} from "./EndpointCatalogOrigin";

const renderOrigin = (annotations: Record<string, string> | null) =>
  render(<EndpointCatalogOrigin annotations={annotations} />);

describe("EndpointCatalogOrigin", () => {
  it("names the catalog, the profile and each option", () => {
    renderOrigin(
      buildCatalogOriginAnnotations({
        catalog: "qwen3.6-35b",
        variant: "fp8",
        features: [{ name: "max-model-len", value: "32768" }, { name: "cp" }],
      }),
    );

    const block = screen.getByTestId("endpoint-catalog-origin");
    expect(within(block).getByText("qwen3.6-35b")).toBeDefined();
    expect(within(block).getByText("fp8")).toBeDefined();
    expect(within(block).getByText("max-model-len: 32768")).toBeDefined();
    expect(within(block).getByText("cp")).toBeDefined();
  });

  it("renders nothing for an endpoint that names no catalog", () => {
    renderOrigin(null);

    expect(screen.queryByTestId("endpoint-catalog-origin")).toBeNull();
  });

  // Best effort: the catalog and the profile still read correctly, and the
  // gap is stated rather than shown as "no options chosen".
  it("says so when the recorded options cannot be read", () => {
    renderOrigin({
      "neutree.ai/model-catalog": "qwen3.6-35b",
      "neutree.ai/model-catalog-variant": "fp8",
      "neutree.ai/model-catalog-features": "{not json",
    });

    const block = screen.getByTestId("endpoint-catalog-origin");
    expect(within(block).getByText("qwen3.6-35b")).toBeDefined();
    expect(
      within(block).getByText("endpoints.origin.featuresUnreadable"),
    ).toBeDefined();
  });
});

describe("EndpointCatalogOriginLink", () => {
  it("links the catalog by name and keeps the variant in a tooltip", () => {
    render(
      <EndpointCatalogOriginLink
        origin={{
          catalog: "qwen3-6-27b",
          variant: "bf16",
          features: [],
          featuresUnreadable: false,
        }}
        workspace="default"
      />,
    );

    expect(
      screen.getByRole("link", { name: "qwen3-6-27b" }).getAttribute("href"),
    ).toBe("#/default/model_catalogs/qwen3-6-27b");
    expect(screen.getByRole("tooltip").textContent).toBe(
      'endpoints.origin.variant {"variant":"bf16"}',
    );
  });

  it("is a plain link for a catalog without variants", () => {
    render(
      <EndpointCatalogOriginLink
        origin={{
          catalog: "llama-3-8b",
          features: [],
          featuresUnreadable: false,
        }}
        workspace="default"
      />,
    );

    expect(screen.getByRole("link", { name: "llama-3-8b" })).toBeDefined();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
