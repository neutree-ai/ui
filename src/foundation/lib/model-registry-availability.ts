/**
 * Whether a registry can be listed from, read from what the server reported
 * about it rather than from its type string.
 *
 * The other half of "what can this registry do" — the rules that follow from
 * the computed `visibility` field — lives in `./model-registry-visibility`.
 * Both halves sit in foundation because `domains/endpoint` and
 * `domains/model-registry` each need them and one L2 domain may not import
 * another.
 *
 * The parameter is structural so that a caller holding only the fields it
 * selected satisfies it; nothing here reads the rest of the record.
 */
export type RegistryAvailability = {
  metadata: { deletion_timestamp?: string | null };
  status?: { phase?: string } | null;
};

/** Whether the registry is answering at all. `Failed` is the reachability
 * verdict; the reason and the check time come with it. */
export const registryIsUnreachable = (registry: RegistryAvailability) =>
  registry.status?.phase === "Failed";

/**
 * Whether the registry has been withdrawn.
 *
 * A registry is deleted in two steps: the row is stamped with a
 * `deletion_timestamp` at once, and the control plane reports `Deleted` when it
 * has torn the registry down. Either one means nothing can be listed from it,
 * and the stamp lands first — reading only the phase would leave the window
 * between them looking like a healthy but inexplicably empty registry.
 */
export const registryIsDisabled = (registry: RegistryAvailability) =>
  Boolean(registry.metadata.deletion_timestamp) ||
  registry.status?.phase === "Deleted";
