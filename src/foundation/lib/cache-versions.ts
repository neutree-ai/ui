export type CacheVersion = {
  version: string;
  engine_versions: string[];
};

/** vLLM versions the given cache runtime version supports; empty when unknown. */
export function engineVersionsFor(
  versions: CacheVersion[] | undefined,
  runtimeVersion: string | undefined,
): string[] {
  return (
    versions?.find((v) => v.version === runtimeVersion)?.engine_versions ?? []
  );
}
