import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PermissionsTree from "./PermissionsTree";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

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

    expect(screen.getByText("workspaces.title")).toBeTruthy();
    expect(screen.queryByText("static_node_clusters.title")).toBeNull();
    expect(screen.queryByText("static_nodes.title")).toBeNull();
  });
});
