/**
 * Permission groups follow the alphabet, except a resource managed from
 * another's page: Log Forwarding is set up from the Access Log, whose read
 * permission (`trace-read`) lives on the external endpoint group.
 */
const PLACED_AFTER: Record<string, string> = {
  log_sink: "external_endpoint",
};

export const sortPermissionResources = (resources: string[]): string[] => {
  const present = new Set(resources);
  const placed = (resource: string) =>
    resource in PLACED_AFTER && present.has(PLACED_AFTER[resource]);

  const ordered = resources.filter((resource) => !placed(resource)).sort();
  for (const resource of resources.filter(placed).sort()) {
    ordered.splice(ordered.indexOf(PLACED_AFTER[resource]) + 1, 0, resource);
  }
  return ordered;
};
