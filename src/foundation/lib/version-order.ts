import { compareVersions, validate } from "compare-versions";

type Versioned = { version: string };

/**
 * Engine packages are not guaranteed to be strict semver, so known semver
 * values rank above free-form labels and the fallback keeps digit runs numeric.
 */
function compareNaturally(a: string, b: string): number {
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
    if (lIsNumber !== rIsNumber) return lIsNumber ? 1 : -1;

    const diff = l.toLowerCase().localeCompare(r.toLowerCase());
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }

  return 0;
}

export function compareVersionStrings(a: string, b: string): number {
  const aIsVersion = validate(a);
  const bIsVersion = validate(b);
  if (aIsVersion && bIsVersion) return compareVersions(a, b);
  if (aIsVersion) return 1;
  if (bIsVersion) return -1;
  return compareNaturally(a, b);
}

export function sortVersionsNewestFirst<T extends Versioned>(
  versions: T[],
): T[] {
  return versions
    .map((version, index) => ({ version, index }))
    .sort((a, b) => {
      const diff = compareVersionStrings(a.version.version, b.version.version);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map((entry) => entry.version)
    .reverse();
}

export function newestVersion<T extends Versioned>(
  versions: T[],
): T | undefined {
  const sorted = sortVersionsNewestFirst(versions);
  return sorted[0];
}
