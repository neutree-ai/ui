import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ModelSpec } from "@/domains/endpoint/types";
import EndpointModel from "./EndpointModel";

vi.mock("@/foundation/scene/ShowButton", () => ({
  ShowButton: ({
    children,
    recordItemId,
    resource,
    meta,
  }: {
    children: ReactNode;
    recordItemId: string;
    resource: string;
    meta: { workspace: string; query?: Record<string, string> };
  }) => (
    <span
      data-resource={resource}
      data-id={recordItemId}
      data-workspace={meta.workspace}
      data-query={JSON.stringify(meta.query ?? {})}
    >
      {children}
    </span>
  ),
}));

const model = (spec: Partial<ModelSpec>) => spec as ModelSpec;

describe("EndpointModel", () => {
  it("renders the name and version as plain text without a workspace", () => {
    render(
      <EndpointModel
        model={model({ registry: "model-nfs", name: "qwen", version: "v1" })}
      />,
    );

    expect(screen.queryByText("model-nfs")).toBeNull();
    expect(screen.getByText("qwen:v1").dataset.resource).toBeUndefined();
  });

  it("renders a placeholder for a model-free endpoint", () => {
    render(<EndpointModel model={null} />);

    screen.getByText("-");
  });

  // On the endpoint detail page the registry opens the registry, and
  // the model opens that model's drawer inside it.
  it("links the registry and the model when given a workspace", () => {
    render(
      <EndpointModel
        model={model({ registry: "model-nfs", name: "qwen", version: "v1" })}
        workspace="ws"
      />,
    );

    const registry = screen.getByText("model-nfs");
    expect(registry.dataset).toMatchObject({
      resource: "model_registries",
      id: "model-nfs",
      workspace: "ws",
      query: "{}",
    });

    const modelLink = screen.getByText("qwen:v1");
    expect(modelLink.dataset).toMatchObject({
      resource: "model_registries",
      id: "model-nfs",
      workspace: "ws",
    });
    expect(JSON.parse(modelLink.dataset.query ?? "")).toEqual({
      model: "qwen",
      version: "v1",
    });
  });

  it("leaves the version out of the model link when there is none", () => {
    render(
      <EndpointModel
        model={model({ registry: "model-nfs", name: "qwen" })}
        workspace="ws"
      />,
    );

    expect(JSON.parse(screen.getByText("qwen").dataset.query ?? "")).toEqual({
      model: "qwen",
    });
  });
});
