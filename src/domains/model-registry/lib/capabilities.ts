import type { ModelRegistry } from "@/domains/model-registry/types";

/**
 * What a registry's reported *phase* means for what the UI can show.
 *
 * The other half of this — the rules that follow from the server's computed
 * `visibility` field, and from the `Content-Range` a listing came back with —
 * lives in `@/foundation/lib/model-registry-visibility`, because
 * `domains/endpoint` needs those too and one L2 domain may not import another.
 * These two read the whole registry record and only this domain asks, so they
 * stay here.
 *
 * Both halves obey the same rule: the judgement comes from something the server
 * said, never from the registry's type string.
 */

/** Whether the registry is answering at all. `Failed` is the reachability
 * verdict; the reason and the check time come with it. */
export const registryIsUnreachable = (registry: ModelRegistry) =>
  registry.status?.phase === "Failed";

/**
 * Whether the registry has been withdrawn.
 *
 * A registry is deleted in two steps: the row is stamped with a
 * `deletion_timestamp` at once, and the control plane reports `Deleted` when it
 * has torn the registry down. Either one means nothing can be listed from it, and
 * the stamp lands first — reading only the phase would leave the window between
 * them looking like a healthy but inexplicably empty registry.
 */
export const registryIsDisabled = (registry: ModelRegistry) =>
  Boolean(registry.metadata.deletion_timestamp) ||
  registry.status?.phase === "Deleted";
