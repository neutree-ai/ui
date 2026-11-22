import { REST_URL } from "@/foundation/lib/api";
import {
  authHeaders,
  describeErrorBody,
} from "@/foundation/lib/api/registry-models";

/**
 * What an image registry holds, as opposed to the registry records themselves —
 * those are a PostgREST table and go through the data provider. These routes
 * have to talk to the registry, so they can fail in ways a table cannot.
 */

/**
 * How — or whether — a registry's repositories can be enumerated.
 *
 * There is no portable answer. The OCI distribution spec has no endpoint for
 * it, and the `/v2/_catalog` registries inherited from Docker Registry v2 is
 * refused by both registries that matter. So the server asks each registry in
 * its own dialect, and says which one applied:
 *
 * - `harbor-projects` — Harbor lists the project's repositories, paged and
 *   searched on the server.
 * - `namespace-required` — Docker Hub lists a namespace's repositories, and has
 *   no endpoint that enumerates namespaces. The namespace has to be typed.
 * - `unauthorized` — the registry can, and the stored credentials cannot.
 * - `unsupported` — nothing here knows how to ask this registry.
 */
export type ListRepositoriesCapability =
  | "harbor-projects"
  | "namespace-required"
  | "unauthorized"
  | "unsupported";

/**
 * Why a listing was refused, in a form that can be branched on. The same words
 * the model registry routes use, deliberately.
 *
 * `namespace_required` is not a failure — it is the question to put to the
 * user, and the one thing in this feature that cannot be chosen from a list.
 */
type ImageRegistryRefusal =
  | "namespace_required"
  | "not_supported"
  | "registry_unauthorized"
  | "unavailable";

/** An unsuccessful response from these routes, with the refusal kept so a
 * caller can say which one it was. */
export class ImageRegistryContentError extends Error {
  readonly status: number;
  readonly reason: ImageRegistryRefusal | undefined;

  constructor(
    status: number,
    message: string,
    reason: ImageRegistryRefusal | undefined,
  ) {
    super(message);
    this.name = "ImageRegistryContentError";
    this.status = status;
    this.reason = reason;
  }
}

async function errorFrom(res: Response): Promise<ImageRegistryContentError> {
  let body: { message?: string; error?: string; reason?: string } = {};

  try {
    body = (await res.json()) as typeof body;
  } catch {
    // A body that is not JSON leaves us with the status alone.
  }

  return new ImageRegistryContentError(
    res.status,
    // Only the prose is shared with the model registry's helper; the refusals
    // these routes name are their own set, so the reason is read here.
    describeErrorBody(
      { message: body.message, error: body.error },
      res.statusText,
    ),
    body.reason as ImageRegistryRefusal | undefined,
  );
}

type ImageRepositoriesQuery = {
  workspace: string;
  registry: string;
  /** Which namespace to list. Ignored by a registry scoped to one project;
   * required by Docker Hub. */
  namespace?: string;
  /** Narrows the listing, on the server wherever the registry supports it. */
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ImageRepositoryPage = {
  /** Named relative to the registry's prefix, which is what the tags route
   * takes. See `image-reference.ts` for turning one into a value. */
  repositories: string[];
  /** How many matched, or null when the registry did not count them — unknown,
   * not zero. */
  total: number | null;
  hasMore: boolean;
  /** Which dialect the server ended up speaking. */
  capability: ListRepositoriesCapability | null;
};

export async function fetchImageRepositories(
  query: ImageRepositoriesQuery,
  signal?: AbortSignal,
): Promise<ImageRepositoryPage> {
  const params = new URLSearchParams();

  if (query.namespace) {
    params.set("namespace", query.namespace);
  }
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.page && query.page > 1) {
    params.set("page", String(query.page));
  }
  if (query.pageSize !== undefined) {
    params.set("page_size", String(query.pageSize));
  }

  const search = params.toString();
  const res = await fetch(
    `${REST_URL}/workspaces/${encodeURIComponent(
      query.workspace,
    )}/image_registries/${encodeURIComponent(query.registry)}/repositories${
      search ? `?${search}` : ""
    }`,
    { headers: authHeaders(), signal },
  );

  if (!res.ok) {
    throw await errorFrom(res);
  }

  const body = (await res.json()) as {
    repositories?: string[] | null;
    total?: number | null;
    has_more?: boolean;
    capability?: ListRepositoriesCapability | "";
  };

  return {
    repositories: body.repositories ?? [],
    total: body.total ?? null,
    hasMore: Boolean(body.has_more),
    capability: body.capability || null,
  };
}
