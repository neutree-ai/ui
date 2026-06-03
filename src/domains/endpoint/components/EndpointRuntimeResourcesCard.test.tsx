import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EndpointRuntimeResourcesCard from "./EndpointRuntimeResourcesCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("EndpointRuntimeResourcesCard", () => {
  it("renders endpoint resource summary and replica device allocations", () => {
    render(
      <EndpointRuntimeResourcesCard
        resources={{
          summary: {
            products: {
              "Tesla-T4": {
                memory_mib: 23040,
                core_units: 150,
              },
            },
          },
          replicas: [
            {
              instance_id: "endpoint-abc",
              replica_id: "uid-1",
              node_id: "node-1",
              devices: [
                {
                  uuid: "GPU-1",
                  product: "Tesla-T4",
                  memory_mib: 15360,
                  core_units: 100,
                  node_id: "node-1",
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByText("endpoints.sections.runtimeResources"),
    ).toBeTruthy();
    expect(screen.getByText("endpoints.sections.resourceSummary")).toBeTruthy();
    expect(
      screen.getByText("endpoints.sections.replicaResources"),
    ).toBeTruthy();
    expect(screen.getAllByText("Tesla-T4")).toHaveLength(2);
    expect(screen.getByText("23040 MiB")).toBeTruthy();
    expect(screen.getByText("150")).toBeTruthy();
    expect(screen.getByText("endpoint-abc")).toBeTruthy();
    expect(screen.getByText("uid-1")).toBeTruthy();
    expect(screen.getByText("GPU-1")).toBeTruthy();
    expect(screen.getByText("15360 MiB")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("renders nothing when runtime resources are empty", () => {
    const { container } = render(
      <EndpointRuntimeResourcesCard resources={null} />,
    );
    expect(container.childElementCount).toBe(0);
  });
});
