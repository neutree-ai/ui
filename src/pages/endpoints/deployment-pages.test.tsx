import { render, screen } from "@testing-library/react";
import { describe, it, vi } from "vitest";

vi.mock("@/domains/endpoint/components/EndpointDeploymentForm", () => ({
  EndpointDeploymentForm: ({ action }: { action: "create" | "edit" }) => (
    <div data-testid={`endpoint-deployment-${action}`} />
  ),
}));

import { EndpointsCreate } from "./create";
import { EndpointsEdit } from "./edit";

describe("endpoint deployment pages", () => {
  it("wire create and edit routes to the matching deployment flow", () => {
    render(
      <>
        <EndpointsCreate />
        <EndpointsEdit />
      </>,
    );

    screen.getByTestId("endpoint-deployment-create");
    screen.getByTestId("endpoint-deployment-edit");
  });
});
