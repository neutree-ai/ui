import { compareVersions, validate } from "compare-versions";

export function isUpgradeVersion(
  candidate: string | null | undefined,
  currentSpecVersion: string | null | undefined,
): boolean {
  if (typeof candidate !== "string" || !validate(candidate)) return false;

  return (
    typeof currentSpecVersion !== "string" ||
    !validate(currentSpecVersion) ||
    compareVersions(candidate, currentSpecVersion) > 0
  );
}

export function getUpgradeVersions(
  candidates: readonly string[],
  currentSpecVersion: string | null | undefined,
): string[] {
  const validCandidates = [...new Set(candidates.filter(validate))].sort(
    compareVersions,
  );

  if (typeof currentSpecVersion !== "string" || !validate(currentSpecVersion)) {
    return validCandidates;
  }

  return validCandidates.filter((candidate) =>
    isUpgradeVersion(candidate, currentSpecVersion),
  );
}
