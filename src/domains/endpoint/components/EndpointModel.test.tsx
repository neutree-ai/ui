import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ModelSpec } from "@/domains/endpoint/types";
import EndpointModel from "./EndpointModel";

const model = (spec: Partial<ModelSpec>) => spec as ModelSpec;

describe("EndpointModel", () => {
  it("renders name and version when the endpoint names a model", () => {
    render(
      <EndpointModel model={model({ name: "qwen3-8b", version: "v1" })} />,
    );

    expect(screen.getByText("qwen3-8b:v1")).toBeTruthy();
  });

  it("renders the bare name when there is no version", () => {
    render(<EndpointModel model={model({ name: "qwen3-8b" })} />);

    expect(screen.getByText("qwen3-8b")).toBeTruthy();
  });

  // A Flex endpoint deploys with no model at all, so the API omits spec.model
  // entirely. Dereferencing it used to throw and, with no error boundary above
  // it, blank the whole endpoints list page (NEU-728).
  it("renders a placeholder for a model-free endpoint", () => {
    render(<EndpointModel model={null} />);

    expect(screen.getByText("-")).toBeTruthy();
  });
});
