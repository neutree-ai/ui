import type { UpstreamStatus } from "@/domains/external-endpoint/types";

// A failed provider does not make a model unavailable when another provider
// for the same model is still ready.
export function getUnavailableModels(
  statuses: (UpstreamStatus | null)[],
): Set<string> {
  const readyModels = new Set(
    statuses
      .filter((status) => status?.phase === "Ready")
      .flatMap((status) => status?.models ?? []),
  );
  return new Set(
    statuses
      .filter((status) => status?.phase === "Failed")
      .flatMap((status) => status?.models ?? [])
      .filter((model) => !readyModels.has(model)),
  );
}
