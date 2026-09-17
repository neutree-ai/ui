import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ModelSpec } from "@/domains/endpoint/types";
import EndpointModel from "./EndpointModel";

const model = (spec: Partial<ModelSpec>) => spec as ModelSpec;

describe("EndpointModel", () => {
  it("renders the model name without its version", () => {
    render(
      <EndpointModel
        model={model({ name: "qwen3-8b", version: "64x4t4fokobpkusu" })}
      />,
    );

    expect(screen.getByText("qwen3-8b")).toBeTruthy();
    expect(screen.queryByText(/64x4t4fokobpkusu/)).toBeNull();
  });

  // A Flex endpoint deploys with no model at all, so the API omits spec.model
  // entirely. Dereferencing it used to throw and, with no error boundary above
  // it, blank the whole endpoints list page (NEU-728).
  it("renders a placeholder for a model-free endpoint", () => {
    render(<EndpointModel model={null} />);

    expect(screen.getByText("-")).toBeTruthy();
  });
});
