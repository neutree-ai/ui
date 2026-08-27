import {
  registryHostOf,
  relativeRepository,
} from "@/foundation/lib/image-reference";

/**
 * Namespaces to offer for a registry that cannot enumerate its own.
 *
 * Docker Hub has no endpoint that lists namespaces, so the complete set is not
 * obtainable and this does not pretend otherwise — the level stays typeable and
 * says so. What can be offered is two things that are true rather than guessed:
 *
 *  - `library`, where Docker Hub keeps its official images (`nginx` is really
 *    `library/nginx`);
 *  - the namespaces this deployment is already using, read out of its own
 *    endpoints and engines.
 *
 * The second is the same rule the model side follows: read what actually exists
 * in the installation rather than shipping a table of names that goes stale.
 * Nothing here calls out to a registry, and no route was added for it.
 *
 * Deliberately not done: asking Docker Hub which organisations a credential
 * belongs to. That endpoint is unverified, and the registry in play is
 * anonymous — there would be no credential to ask with.
 */

/** Docker Hub's official images live here. */
export const DOCKER_HUB_OFFICIAL_NAMESPACE = "library";

/**
 * Drops the tag from a reference. Only the last path segment can carry one, so
 * a registry's port — `registry:5000/team/x` — is left alone.
 */
function repositoryOf(reference: string): string {
  const trimmed = reference.trim();
  const at = trimmed.lastIndexOf("/");
  const head = at < 0 ? "" : trimmed.slice(0, at + 1);
  const last = trimmed.slice(at + 1);
  const colon = last.lastIndexOf(":");

  return colon < 0 ? trimmed : head + last.slice(0, colon);
}

/**
 * The namespace a reference sits in, as seen from one registry, or empty when
 * it names no namespace or belongs to a different registry.
 */
function namespaceOf(reference: string, prefix: string): string {
  const repository = relativeRepository(repositoryOf(reference), prefix);
  const parts = repository.split("/").filter(Boolean);

  // Fewer than two parts is a bare repository with no namespace. A first part
  // that names a host means the reference was never reduced by the prefix --
  // it belongs to some other registry, and its namespace is not one of these.
  if (parts.length < 2 || registryHostOf(repository)) {
    return "";
  }

  return parts[0] as string;
}

/** Reads every image reference this deployment mentions, from resources the
 * console already lists. */
export function imageReferencesFrom(
  endpoints: unknown[],
  engines: unknown[],
): string[] {
  const references: string[] = [];

  for (const row of endpoints) {
    // Where the Flex engine's per-endpoint image override is kept.
    const image = (
      row as {
        spec?: { variables?: { engine_args?: { image?: unknown } } };
      }
    ).spec?.variables?.engine_args?.image;

    if (typeof image === "string" && image.trim()) {
      references.push(image);
    }
  }

  for (const row of engines) {
    const versions =
      (row as { spec?: { versions?: unknown[] } }).spec?.versions ?? [];

    for (const version of versions) {
      const images =
        (version as { images?: Record<string, { image_name?: unknown }> })
          .images ?? {};

      for (const image of Object.values(images)) {
        if (typeof image?.image_name === "string" && image.image_name.trim()) {
          references.push(image.image_name);
        }
      }
    }
  }

  return references;
}

/**
 * The namespaces to offer, `library` first because it is where someone reaching
 * for `nginx` or `redis` actually needs to look, then whatever this deployment
 * already uses, in alphabetical order.
 */
export function namespaceSuggestions(
  references: string[],
  prefix: string,
): string[] {
  const found = new Set<string>();

  for (const reference of references) {
    const namespace = namespaceOf(reference, prefix);

    if (namespace && namespace !== DOCKER_HUB_OFFICIAL_NAMESPACE) {
      found.add(namespace);
    }
  }

  return [DOCKER_HUB_OFFICIAL_NAMESPACE, ...[...found].sort()];
}
