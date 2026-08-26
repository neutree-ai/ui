import { RegistryModelError } from "@/foundation/lib/api/registry-models";
import type { ModelInfo } from "@/foundation/types/serving-types";

/**
 * What came back when a screen asked the registry what a checkpoint states
 * about itself.
 *
 * The distinction this exists to keep is between "we could not read it" and
 * "it does not say": a gated repository that needs a token, a model that is not
 * there, and a config.json the registry parsed nothing out of are three
 * different situations with three different things for a user to do, and none
 * of them is the same as a checkpoint that simply omits a field. Collapsing
 * them into one sentence sends people looking in the wrong place.
 */
export type ModelInfoRead =
  /** Nothing is selected yet, so nothing was asked. */
  | { state: "none" }
  | { state: "loading" }
  /**
   * The registry refused or could not answer. `message` is the server's own
   * wording, which usually names the specific obstacle (a gated repository, a
   * rate limit) better than the category does.
   */
  | {
      state: "unread";
      reason: "unauthorized" | "not-found" | "unavailable";
      message: string | null;
    }
  /** The registry answered and said nothing about the checkpoint's shape. */
  | { state: "unreported" }
  /** The registry answered, looked, and could establish no field at all —
   * a checkpoint with no readable config.json. */
  | { state: "unparsed" }
  | { state: "ready"; info: ModelInfo };

type ModelInfoReadInputs = {
  /** Whether a model has been chosen at all. */
  selected: boolean;
  /** What the caller already holds, if anything: a catalog carries `info` with
   * it and must not be made to pay for a read. */
  info: ModelInfo | null | undefined;
  isLoading: boolean;
  error: unknown;
};

/**
 * Classifies a refusal. The server names its own refusals (`reason`), so those
 * are read first; the status code is the fallback for a failure that never
 * reached that layer, such as a gateway error.
 */
function unreadFrom(error: RegistryModelError): ModelInfoRead {
  const message = error.message || null;

  if (error.reason === "registry_unauthorized") {
    return { state: "unread", reason: "unauthorized", message };
  }

  if (error.reason === "not_found") {
    return { state: "unread", reason: "not-found", message };
  }

  if (error.status === 401 || error.status === 403) {
    return { state: "unread", reason: "unauthorized", message };
  }

  if (error.status === 404) {
    return { state: "unread", reason: "not-found", message };
  }

  return { state: "unread", reason: "unavailable", message };
}

/**
 * Whether a parse established nothing at all.
 *
 * A checkpoint whose config.json could not be read comes back with every field
 * named in missing_fields and no value or provenance anywhere — which is not
 * the same shape as a checkpoint that states most fields and omits one.
 */
function establishedNothing(info: ModelInfo): boolean {
  const sourced = Object.keys(info.field_sources ?? {}).length > 0;
  const looked = (info.missing_fields ?? []).length > 0;

  return !sourced && looked;
}

export function resolveModelInfoRead(
  inputs: ModelInfoReadInputs,
): ModelInfoRead {
  if (!inputs.selected) {
    return { state: "none" };
  }

  if (inputs.error instanceof RegistryModelError) {
    return unreadFrom(inputs.error);
  }

  if (inputs.error) {
    return { state: "unread", reason: "unavailable", message: null };
  }

  if (inputs.isLoading) {
    return { state: "loading" };
  }

  if (!inputs.info) {
    return { state: "unreported" };
  }

  if (establishedNothing(inputs.info)) {
    return { state: "unparsed" };
  }

  return { state: "ready", info: inputs.info };
}
