import { render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pass } = vi.hoisted(() => ({
  pass: ({ children }: PropsWithChildren) => children,
}));

vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: pass,
  SidebarContent: pass,
  SidebarGroup: pass,
  SidebarGroupContent: pass,
  SidebarGroupLabel: pass,
  SidebarHeader: pass,
  SidebarMenu: pass,
  SidebarMenuButton: pass,
  SidebarMenuItem: pass,
  useSidebar: () => ({ state: "expanded" }),
}));

vi.mock("@/foundation/components/Link", () => ({
  Link: ({ children, href }: PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/foundation/hooks/use-workspace", () => ({
  useWorkspace: () => ({ current: "default" }),
}));

vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasPermission: vi.fn(),
}));

const settingsMenu = vi.hoisted(() => ({
  name: "settings",
  meta: { title: "Settings" },
  children: [
    {
      name: "identity_sources",
      route: "/identity-sources",
      list: "/identity-sources",
      meta: {
        title: "Identity Sources",
        requiredPermission: "identity_source:read",
      },
      children: [],
    },
    {
      name: "oem_configs",
      route: "/oem-configs",
      list: "/oem-configs",
      meta: { title: "Customize Appearance" },
      children: [],
    },
  ],
}));

vi.mock("@refinedev/core", () => ({
  useMenu: () => ({ menuItems: [settingsMenu] }),
  useResourceParams: () => ({ id: undefined }),
}));

import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { AppSidebar } from "./AppSidebar";

const permissionState = (granted: Record<string, boolean | undefined>) =>
  vi.mocked(useHasPermission).mockImplementation((permission?: string) =>
    permission
      ? {
          allowed: granted[permission],
          isLoading: granted[permission] === undefined,
        }
      : { allowed: true, isLoading: false },
  );

const renderSidebar = () =>
  render(
    <MemoryRouter>
      <AppSidebar />
    </MemoryRouter>,
  );

describe("AppSidebar permission gating", () => {
  beforeEach(() => vi.mocked(useHasPermission).mockReset());

  it("lists a gated resource for a user holding its permission", () => {
    permissionState({ "identity_source:read": true });
    renderSidebar();
    expect(screen.getByText("Identity Sources")).toBeTruthy();
    expect(screen.getByText("Customize Appearance")).toBeTruthy();
  });

  it("hides a gated resource from a user without its permission", () => {
    permissionState({ "identity_source:read": false });
    renderSidebar();
    expect(screen.queryByText("Identity Sources")).toBeNull();
    expect(screen.getByText("Customize Appearance")).toBeTruthy();
  });

  it("does not flash a gated resource while the check is pending", () => {
    permissionState({ "identity_source:read": undefined });
    renderSidebar();
    expect(screen.queryByText("Identity Sources")).toBeNull();
  });
});
