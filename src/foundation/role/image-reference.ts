/**
 * Reading and writing the container image references a workload image field
 * holds.
 *
 * Two namespaces meet in that field and they are not the same one. The value is
 * used verbatim by whatever runs the workload, so it has to be a reference a
 * container runtime resolves — registry host included, or the runtime resolves
 * it against Docker Hub. The suggestion routes, on the other hand, name a
 * repository *relative to the registry's own prefix*, because that is the only
 * form the registry itself understands. Everything here exists to convert
 * between the two in one place rather than at each call site.
 */

/** Strips the scheme and any trailing slash from a registry URL, as the server
 * does when it composes an image prefix. */
function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/**
 * The prefix images in this registry are pulled from: host, plus the project
 * the registry is scoped to. Mirrors the server's BuildImagePrefix, including
 * its rule that a URL already carrying a path wins over a separate project.
 */
export function imageRegistryPrefix(registry: {
  url?: string | null;
  repository?: string | null;
}): string {
  const host = stripScheme(registry.url ?? "");
  const project = (registry.repository ?? "").trim().replace(/^\/+|\/+$/g, "");

  if (!project || host.includes("/")) {
    return host;
  }

  return `${host}/${project}`;
}

/**
 * Re-expresses a repository the way the suggestion routes take it — relative to
 * the registry's prefix — so a fully-qualified value can still be asked about.
 *
 * A repository that does not sit under the prefix is returned unchanged rather
 * than refused: it may well be a bare name someone typed, which is exactly what
 * this field has always accepted and what the routes have always assumed.
 */
export function relativeRepository(repository: string, prefix: string): string {
  const trimmed = repository.trim().replace(/^\/+|\/+$/g, "");

  if (!prefix || !trimmed.startsWith(`${prefix}/`)) {
    return trimmed;
  }

  return trimmed.slice(prefix.length + 1);
}

/**
 * Builds the value the field holds from a browsed repository and tag.
 *
 * Fully qualified, always. The suggestion side of this feature is relative, but
 * the value is not a suggestion — it is the reference the runtime resolves, and
 * a relative one resolves somewhere other than the registry it was browsed in.
 */
export function qualifyReference(
  repository: string,
  tag: string,
  prefix: string,
): string {
  const relative = relativeRepository(repository, prefix);
  const qualified = prefix ? `${prefix}/${relative}` : relative;

  return tag ? `${qualified}:${tag}` : qualified;
}

/**
 * The registry host a reference names, or empty when it names none.
 *
 * A first segment is a host when it carries a dot or a port — the same rule a
 * container runtime applies, and the reason a bare `vllm/vllm-openai` resolves
 * against Docker Hub rather than against whatever registry it was read from.
 */
export function registryHostOf(reference: string): string {
  const first = reference.trim().replace(/^\/+/, "").split("/")[0] ?? "";

  if (first === "localhost" || first.includes(".") || first.includes(":")) {
    return first;
  }

  return "";
}
