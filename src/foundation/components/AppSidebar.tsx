import { useMenu, useResourceParams } from "@refinedev/core";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import {
  buildMenuItemPaths,
  isMenuItemActive,
} from "@/foundation/lib/sidebar-active";

type TreeMenuItem = ReturnType<typeof useMenu>["menuItems"][number];

import React from "react";
import { useLocation } from "react-router";
import { Link } from "./Link";

const GetIcon = (item: TreeMenuItem) => {
  const icon = item.meta?.icon;
  if (React.isValidElement<{ className?: string }>(icon)) {
    return React.cloneElement(icon, {
      className: "size-4",
    });
  }
  return null;
};

type AppSidebarMenuItemProps = {
  item: TreeMenuItem;
  state: "collapsed" | "expanded";
};

function AppSidebarMenuItem({ item, state }: AppSidebarMenuItemProps) {
  const resourceParams = useResourceParams();
  const { current: currentWorkspace } = useWorkspace();
  const { pathname } = useLocation();
  const currentPathname = String(pathname);

  const paths = buildMenuItemPaths(
    item,
    currentWorkspace,
    resourceParams.id as string,
  );

  const route = item.route?.replace(":workspace", currentWorkspace);

  const isActive = isMenuItemActive(paths, currentPathname);

  return (
    <SidebarMenuItem className="px-1">
      {state === "collapsed" ? (
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={
            <span className="flex items-center gap-4">
              {item.label}
              {item.meta?.label && (
                <span className="ml-auto text-muted-foreground">
                  {item.meta?.label}
                </span>
              )}
            </span>
          }
        >
          <Link href={route ?? "/#"} title={item.meta?.title ?? item.name}>
            {GetIcon(item)}
            <span className="sr-only">
              {item.meta?.title ?? item.label} {item.list ? "List" : "Create"}
            </span>
          </Link>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton asChild isActive={isActive}>
          <Link href={route ?? "/#"} title={item.meta?.title ?? item.name}>
            {GetIcon(item)}
            <span>{item.meta?.title ?? item.name}</span>
          </Link>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}

type AppSidebarProps = {
  logo?: {
    collapsed?: React.ReactElement | React.ReactNode;
    default: React.ReactElement | React.ReactNode;
  };
};

export function AppSidebar({ logo }: AppSidebarProps) {
  const { menuItems } = useMenu({
    hideOnMissingParameter: false,
  });

  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        {state === "collapsed" ? logo?.collapsed : logo?.default}
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems
            .filter((i) => !i.meta?.hide)
            .map((item, key) => {
              if (item.children.length) {
                return (
                  <SidebarGroup key={key}>
                    <SidebarGroupLabel>
                      {item.meta?.title ?? item.name}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {item.children
                          .filter((i) => !i.meta?.hide)
                          .map((childItem, key) => {
                            return (
                              <AppSidebarMenuItem
                                key={key}
                                item={childItem}
                                state={state}
                              />
                            );
                          })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                );
              }

              return (
                <SidebarGroup key={key}>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <AppSidebarMenuItem item={item} state={state} />
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
