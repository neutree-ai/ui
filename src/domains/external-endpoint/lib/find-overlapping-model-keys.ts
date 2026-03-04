import type { UpstreamSpec } from "@/domains/external-endpoint/types";

/**
 * Returns the model_mapping keys at `currentIndex` that also appear
 * in any other upstream's model_mapping within the same endpoint.
 */
export function findOverlappingModelKeys(
  upstreams: Pick<UpstreamSpec, "model_mapping">[],
  currentIndex: number,
): string[] {
  const currentKeys = Object.keys(upstreams[currentIndex]?.model_mapping ?? {});
  const otherKeys = new Set<string>();
  for (let i = 0; i < upstreams.length; i++) {
    if (i === currentIndex) continue;
    for (const key of Object.keys(upstreams[i]?.model_mapping ?? {})) {
      if (key) otherKeys.add(key);
    }
  }
  return currentKeys.filter((k) => k && otherKeys.has(k));
}
