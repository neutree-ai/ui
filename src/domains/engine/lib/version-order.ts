import { compareVersions, validate } from "compare-versions";
import type { EngineVersion } from "@/domains/engine/types";

/**
 * Engine versions come from engine packages (built-in definitions and
 * `neutree-cli engine import`), so they are not guaranteed to be strict semver:
 * packages ship labels such as `v1.0.RC2` or `latest`, which `compare-versions`
 * rejects by throwing. Keep the semver path for the common case and fall back to
 * a natural-order comparison that keeps digit runs numeric.
 */
function compareNaturally(a: string, b: string): number {
  // Split into digits, letters and separators separately: merging a separator
  // into the following label (".RC") would compare the dot instead of the label.
  const tokenize = (value: string) =>
    value.match(/\d+|\p{L}+|[^\p{L}\d]+/gu) ?? [];
  const left = tokenize(a);
  const right = tokenize(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const l = left[i];
    const r = right[i];
    if (l === undefined) return -1;
    if (r === undefined) return 1;

    const lIsNumber = /^\d+$/.test(l);
    const rIsNumber = /^\d+$/.test(r);
    if (lIsNumber && rIsNumber) {
      const diff = Number(l) - Number(r);
      if (diff !== 0) return diff > 0 ? 1 : -1;
      continue;
    }
    // A label chunk ranks below the numeric release at the same position, so
    // `v1.0.RC2` sorts below `v1.0.0` like a pre-release should.
    if (lIsNumber !== rIsNumber) return lIsNumber ? 1 : -1;

    const diff = l.toLowerCase().localeCompare(r.toLowerCase());
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }

  return 0;
}

/** Ascending order: negative when `a` is older than `b`, 0 when equal. */
export function compareEngineVersions(a: string, b: string): number {
  if (validate(a) && validate(b)) return compareVersions(a, b);
  return compareNaturally(a, b);
}

/** Oldest → newest. Ties keep the order the engine returned. */
function sortEngineVersions(versions: EngineVersion[]): EngineVersion[] {
  return versions
    .map((version, index) => ({ version, index }))
    .sort((a, b) => {
      const diff = compareEngineVersions(a.version.version, b.version.version);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map((entry) => entry.version);
}

/** Newest → oldest, the order every version list in the UI renders. */
export function sortEngineVersionsNewestFirst(
  versions: EngineVersion[],
): EngineVersion[] {
  return sortEngineVersions(versions).reverse();
}

/**
 * The version the UI treats as the default. Engines return their versions in
 * creation order, not newest-first, so never read `spec.versions[0]` for this.
 */
export function newestEngineVersion(
  versions: EngineVersion[],
): EngineVersion | undefined {
  const sorted = sortEngineVersions(versions);
  return sorted[sorted.length - 1];
}
