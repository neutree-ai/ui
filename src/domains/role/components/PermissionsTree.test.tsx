import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PermissionsTree from "./PermissionsTree";

describe("PermissionsTree", () => {
  it("hides static node permissions while rendering supported permissions", () => {
    render(
      <PermissionsTree
        permissions={[
          "workspace:read",
          "static_node_cluster:read",
          "static_node:read",
        ]}
      />,
    );

    screen.getByText("workspaces.title");
    expect(screen.queryByText("static_node_clusters.title")).toBeNull();
    expect(screen.queryByText("static_nodes.title")).toBeNull();
  });
});
