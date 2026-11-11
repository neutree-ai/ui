import { render, screen } from "@testing-library/react";
import { describe, it } from "vitest";
import { PolicySourceLabel } from "./PolicySourceLabel";

describe("PolicySourceLabel", () => {
  it("keeps the scope apart from the text before it", () => {
    render(
      <PolicySourceLabel
        source={{
          owner: "subject",
          scopeKind: "OrgUnit",
          scopeName: "ou-rnd",
          scopeLabel: "rnd",
        }}
      />,
    );
    // A label merged into the preceding text would only match "…set inrnd".
    screen.getByText("rnd", { exact: true });
  });
});
