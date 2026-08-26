import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { buildCatalogOriginAnnotations } from "@/domains/endpoint/lib/catalog-origin";
import { EndpointCatalogOrigin } from "./EndpointCatalogOrigin";

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
