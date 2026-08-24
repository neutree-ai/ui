/**
 * Whether the control plane provisions and owns a registry.
 *
 * Kept in the domain rather than in foundation because only this domain asks:
 * the answer decides which controls a registry's row and detail page offer, and
 * nothing outside model-registry renders those. The rules that `domains/endpoint`
 * needs too are the ones that moved out, to `@/foundation/lib/model-registry-availability`
 * and `@/foundation/lib/model-registry-visibility`.
 *
 * Like those, this reads something the server said. It is never derived from the
 * registry's type, which a user's own registry shares, nor from a list of
 * reserved names held here, which would go stale the moment a hub is added.
 */

/**
 * The annotation the control plane stamps on everything it provisions and owns.
 * Generic to every resource kind, and spelt out rather than derived: it is a
 * wire contract with the server, so the literal is the specification.
 */
const BUILTIN_ANNOTATION_KEY = "neutree.ai/builtin";

/**
 * The part of a registry this reads. Structural, so a caller holding only the
 * fields it selected satisfies it.
 */
type ProvisionedResource = {
  metadata: { annotations?: Record<string, string> | null };
};

/**
 * Whether the control plane provisions and owns this registry.
 *
 * Provisioned registries are configured by a neutree-core setting, not through
 * the API: an edit or a delete against one is refused, so the entry points that
 * lead there are withheld rather than left to fail.
 */
export const registryIsProvisioned = (registry: ProvisionedResource) =>
  registry.metadata.annotations?.[BUILTIN_ANNOTATION_KEY] === "true";
