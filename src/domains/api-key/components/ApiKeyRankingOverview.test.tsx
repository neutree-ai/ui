import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiKeyRankingOverview } from "./ApiKeyRankingOverview";

describe("ApiKeyRankingOverview", () => {
  it("uses an explicit empty state without a bare dash", () => {
    render(
      <ApiKeyRankingOverview
        keys={[{ id: "key-without-traffic", name: "Idle key" }]}
        traffic={new Map()}
      />,
    );

    expect(screen.getAllByText("api_keys.ranking.empty")).toHaveLength(2);
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.queryByText("-")).toBeNull();
  });
});
