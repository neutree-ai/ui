interface MenuItemRoutes {
  list?: { toString(): string };
  create?: { toString(): string };
  edit?: { toString(): string };
  show?: { toString(): string };
  children?: MenuItemRoutes[];
}

/**
 * Build the resolved route paths for a menu item by substituting
 * `:workspace` and `:id` placeholders. A child resource's pages count as the
 * item's own: such a child is kept out of the menu and opened from the
 * item's page (Log Forwarding under Access Log).
 */
export function buildMenuItemPaths(
  item: MenuItemRoutes,
  currentWorkspace: string,
  resourceId: string,
): string[] {
  const own = [
    item.list?.toString(),
    item.create?.toString(),
    item.edit?.toString().replace(":id", resourceId),
    item.show?.toString().replace(":id", resourceId),
  ]
    .map((s) => s?.replace(":workspace", currentWorkspace))
    .filter(Boolean) as string[];
  return [
    ...own,
    ...(item.children ?? []).flatMap((child) =>
      buildMenuItemPaths(child, currentWorkspace, resourceId),
    ),
  ];
}

/**
 * Determine whether a sidebar menu item should be highlighted as active
 * based on the current pathname.
 */
export function isMenuItemActive(
  paths: string[],
  currentPathname: string,
): boolean {
  return (
    paths.includes(currentPathname) ||
    paths.some(
      (path) =>
        path.startsWith(currentPathname) || currentPathname.startsWith(path),
    )
  );
}
