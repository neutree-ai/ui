export function buildAvailableClusterVersionsURL(
  clusterType: string | null | undefined,
  workspace: string | null | undefined,
  imageRegistry: string | null | undefined,
): string | undefined {
  if (clusterType !== "ssh" && clusterType !== "kubernetes") {
    return undefined;
  }

  const normalizedWorkspace = workspace?.trim();
  const normalizedImageRegistry = imageRegistry?.trim();
  if (
    !normalizedWorkspace ||
    normalizedWorkspace === "_all_" ||
    !normalizedImageRegistry
  ) {
    return undefined;
  }

  const params = new URLSearchParams({
    workspace: normalizedWorkspace,
    image_registry: normalizedImageRegistry,
    cluster_type: clusterType,
  });

  return `/clusters/available_versions?${params.toString()}`;
}
