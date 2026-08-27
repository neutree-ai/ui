import type { RecipeFeature } from "@/foundation/recipe/types";

/** The engine argument a workload image is written to. */
const IMAGE_ARG = "image";

/** What a recipe feature puts in an engine argument to mean "whatever the user
 * typed". */
const WHOLE_VALUE = "${value}";

/**
 * Whether a recipe feature's input *is* the workload image.
 *
 * Decided by what the feature writes, never by what it is called. `name` and
 * `display_name` belong to whoever authored the catalog — the working example
 * happens to use `image`, but `工作负载镜像` would be just as valid, and keying
 * off either would work by luck. The engine argument it feeds is the real
 * signal.
 *
 * The value has to be exactly `${value}`, and that is the point rather than a
 * detail. A catalog is free to write `image: "myprefix/${value}"`, where what
 * the user supplies is one component of a reference and not a reference at all.
 * Replacing that input with something that produces whole, fully-qualified
 * references would quietly corrupt it, so anything short of sole occupancy is
 * left as the plain text box it already is.
 */
export function writesWorkloadImage(feature: RecipeFeature): boolean {
  if (feature.type !== "input") {
    return false;
  }

  return feature.engine_args?.[IMAGE_ARG] === WHOLE_VALUE;
}
