import type { EngineVersion } from "@/domains/engine/types";
import {
  compareVersionStrings,
  newestVersion,
  sortVersionsNewestFirst as sortSharedVersionsNewestFirst,
} from "@/foundation/lib/version-order";

/**
 * Ascending order: negative when `a` is older than `b`, 0 when equal.
 *
 * A version that parses outranks one that does not, so a free-form package tag
 * such as `qwen38` can never take over as "latest" from a real release like
 * `v0.25.0`.
 */
export const compareEngineVersions = compareVersionStrings;

/** Newest → oldest, the order every version list in the UI renders. */
export function sortEngineVersionsNewestFirst(
  versions: EngineVersion[],
): EngineVersion[] {
  return sortSharedVersionsNewestFirst(versions);
}

/**
 * The version the UI treats as the default. Engines return their versions in
 * creation order, not newest-first, so never read `spec.versions[0]` for this.
 */
export function newestEngineVersion(
  versions: EngineVersion[],
): EngineVersion | undefined {
  return newestVersion(versions);
}
