import { compareVersions } from "compare-versions";

const MIN_ACCELERATOR_VIRTUALIZATION_CLUSTER_VERSION = "v1.1.0";

export function isAcceleratorVirtualizationSupported(
  version: string | null | undefined,
): boolean {
  if (!version) {
    return false;
  }

  try {
    return (
      compareVersions(
        version,
        MIN_ACCELERATOR_VIRTUALIZATION_CLUSTER_VERSION,
      ) >= 0
    );
  } catch {
    return false;
  }
}
