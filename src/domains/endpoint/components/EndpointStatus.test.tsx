import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EndpointReplicaStatusList } from "./EndpointStatus";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("EndpointReplicaStatusList", () => {
  it("renders replica status rows without a role summary", () => {
    render(
      <EndpointReplicaStatusList
        replicas={[
          {
            id: "prefill-0",
            role: "prefill",
            node_name: "gpu-node-a",
            phase: "Ready",
          },
          {
            id: "decode-0",
            role: "decode",
            node_name: "gpu-node-a",
            phase: "Ready",
          },
        ]}
      />,
    );

    expect(screen.getByText("endpoints.status.replicaStatus")).toBeTruthy();
    expect(screen.getByText("common.fields.role")).toBeTruthy();
    expect(screen.getByText("prefill-0")).toBeTruthy();
    expect(screen.getByText("decode-0")).toBeTruthy();
    expect(screen.queryByText("endpoints.status.roleSummary")).toBeNull();
  });

  it("omits the role column when replica statuses do not include roles", () => {
    render(
      <EndpointReplicaStatusList
        replicas={[
          {
            id: "replica-0",
            node_name: "node-a",
            phase: "Ready",
          },
        ]}
      />,
    );

    expect(screen.queryByText("common.fields.role")).toBeNull();
    expect(screen.getByText("replica-0")).toBeTruthy();
    expect(screen.getByText("node-a")).toBeTruthy();
  });

  it("renders nothing when there are no replica statuses", () => {
    const { container } = render(<EndpointReplicaStatusList replicas={[]} />);

    expect(container.firstChild).toBeNull();
  });
});
