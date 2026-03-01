interface MenuItemRoutes {
  list?: { toString(): string };
  create?: { toString(): string };
  edit?: { toString(): string };
  show?: { toString(): string };
}

/**
 * Build the resolved route paths for a menu item by substituting
 * `:workspace` and `:id` placeholders.
 */
export function buildMenuItemPaths(
  item: MenuItemRoutes,
  currentWorkspace: string,
  resourceId: string,
): string[] {
  return [
    item.list?.toString(),
    item.create?.toString(),
    item.edit?.toString().replace(":id", resourceId),
    item.show?.toString().replace(":id", resourceId),
  ]
    .map((s) => s?.replace(":workspace", currentWorkspace))
    .filter(Boolean) as string[];
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
