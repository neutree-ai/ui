import { clientPostgrest, REST_URL } from "@/foundation/lib/api";
import type {
  ModelAliasConflict,
  ModelReference,
  RegistryModel,
  RegistryModelVersion,
} from "@/foundation/types/model-types";
import type { ModelInfo } from "@/foundation/types/serving-types";

/**
 * The models sub-API of a model registry. It is not a PostgREST table, so it
 * does not go through the data provider — and the listing carries its total in
 * a `Content-Range` header, which refine's `useCustom` discards along with the
 * rest of the Response.
 *
 * Every caller of these routes goes through this module: the URL used to be
 * written out twice inside the endpoint form, and a third copy is what this
 * exists to prevent.
 */

/** The error code the server uses for "something still references this model". */
export const MODEL_REFERENCED_CODE = "10131";

type RegistryModelsQuery = {
  workspace: string;
  registry: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type RegistryModelPage = {
  models: RegistryModel[];
  /**
   * How many models matched, or null when the registry cannot count them. The
   * Hugging Face Hub does not report a total and the server sends `*` rather
   * than inventing one, so null means unknown — not zero.
   */
  total: number | null;
  /**
   * The `limit` this page was fetched with, or null when the caller left it to
   * the server.
   *
   * Carried with the page so "did this come back short?" can be answered from
   * the page itself. A caller that compares against whatever it is asking for
   * *now* gets the wrong answer for the whole flight of a widening request, and
   * a permanently wrong one if that request fails.
   */
  limit: number | null;
  /** How old the answer is; see RegistryDataFreshness. */
  freshness: RegistryDataFreshness;
};

/**
 * When the data in a response was read from the registry, as stated by the
 * server rather than measured here.
 *
 * A listing the server served from its cache describes the registry as of when
 * it was fetched, not as of when it was asked for. `X-Neutree-Data-Timestamp`
 * carries that moment and `X-Neutree-Data-Cached` says the answer was reused,
 * so this is reported, never timed locally — a clock in the browser would be
 * measuring the wrong event on the wrong machine.
 */
export type RegistryDataFreshness = {
  /** The moment the data was read from the registry (RFC3339), or null when the
   * response did not say. */
  timestamp: string | null;
  /** Whether the server answered from its cache rather than asking again. */
  cached: boolean;
};

function freshnessFrom(headers: Headers): RegistryDataFreshness {
  return {
    timestamp: headers.get("X-Neutree-Data-Timestamp"),
    cached: headers.get("X-Neutree-Data-Cached") === "true",
  };
}

/**
 * Why a call was refused, in a form that can be branched on.
 *
 * The server names the refusal so a client does not have to match on prose:
 * `not_supported` is "this registry cannot be asked that" (paging from an
 * offset, a model card from a registry that serves none), `not_found` is "it
 * answered, and there is nothing there".
 */
type RegistryModelErrorReason =
  | "not_supported"
  | "not_found"
  | "registry_unauthorized"
  | "rate_limited"
  | "unavailable";

/** The error bodies these routes answer with. Every field is optional: which
 * ones arrive depends on why the call failed. */
type RegistryModelErrorBody = {
  message?: string;
  /** The machine-readable refusal, where the route sends one. */
  reason?: RegistryModelErrorReason;
  /**
   * What a refusal from the permission check is worded as. That layer answers
   * `{error, required}` rather than `{message}`, and its wording is the honest
   * thing to show — the UI does not decide who may write, so when the server
   * says no it says why.
   */
  error?: string;
  /** The permission a refused call would have needed. */
  required?: string;
  /** Present on a rejected delete; MODEL_REFERENCED_CODE when it was blocked. */
  code?: string;
  hint?: string;
  /** What still references the model, on a rejected delete. */
  references?: ModelReference[];
  /** What already holds the alias, on a 409. */
  conflict?: ModelAliasConflict;
};

/** Picks the sentence to show for a failure, preferring whatever the server
 * actually said over the bare status line. */
export function describeErrorBody(
  body: RegistryModelErrorBody,
  statusText: string,
): string {
  if (body.message) {
    return body.message;
  }

  if (body.error) {
    return body.required ? `${body.error} (${body.required})` : body.error;
  }

  return statusText;
}

/** An unsuccessful response from the models sub-API, with its body kept intact
 * so a caller can render the conflict or the reference list it names. */
export class RegistryModelError extends Error {
  readonly status: number;
  readonly body: RegistryModelErrorBody;

  constructor(status: number, body: RegistryModelErrorBody) {
    super(body.message || `model registry request failed: ${status}`);
    this.name = "RegistryModelError";
    this.status = status;
    this.body = body;
  }

  get reason(): RegistryModelErrorReason | undefined {
    return this.body.reason;
  }
}

function modelsBaseUrl(workspace: string, registry: string): string {
  return `${REST_URL}/workspaces/${encodeURIComponent(
    workspace,
  )}/model_registries/${encodeURIComponent(registry)}/models`;
}

/** Builds the listing path, relative to REST_URL. An unset limit is left to the
 * server, and offset 0 is omitted so the common case sends no offset at all. */
function registryModelsPath(query: RegistryModelsQuery): string {
  const params = new URLSearchParams();

  if (query.search) {
    params.set("search", query.search);
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset) {
    params.set("offset", String(query.offset));
  }

  const search = params.toString();

  return `/workspaces/${encodeURIComponent(
    query.workspace,
  )}/model_registries/${encodeURIComponent(query.registry)}/models${
    search ? `?${search}` : ""
  }`;
}

/** Shared with `./model-registries`, which calls a registry-level route the same
 * way and reports its failures with the same error type. */
export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const auth = clientPostgrest.headers.Authorization;

  if (typeof auth === "string" && auth) {
    headers.Authorization = auth;
  }

  return headers;
}

export async function errorFrom(res: Response): Promise<RegistryModelError> {
  let body: RegistryModelErrorBody = {};

  try {
    body = (await res.json()) as RegistryModelErrorBody;
  } catch {
    // A body that is not JSON leaves us with the status alone.
  }

  return new RegistryModelError(res.status, {
    ...body,
    message: describeErrorBody(body, res.statusText),
  });
}

/**
 * Reads the total out of a PostgREST-style range header such as `0-1/5`. A star
 * in place of the size means the registry could not count what matched, which
 * is unknown — not zero.
 */
export function parseContentRangeTotal(header: string | null): number | null {
  const size = header?.split("/")[1]?.trim();

  if (!size || size === "*") {
    return null;
  }

  const total = Number.parseInt(size, 10);

  return Number.isNaN(total) ? null : total;
}

export async function fetchRegistryModels(
  query: RegistryModelsQuery,
  signal?: AbortSignal,
): Promise<RegistryModelPage> {
  const res = await fetch(`${REST_URL}${registryModelsPath(query)}`, {
    headers: authHeaders(),
    signal,
  });

  if (!res.ok) {
    throw await errorFrom(res);
  }

  // The body is a bare array; the count and the age live in the headers.
  const models = (await res.json()) as RegistryModel[] | null;

  return {
    models: models ?? [],
    total: parseContentRangeTotal(res.headers.get("Content-Range")),
    limit: query.limit ?? null,
    freshness: freshnessFrom(res.headers),
  };
}

export type RegistryModelRef = {
  workspace: string;
  registry: string;
  model: string;
  version?: string;
};

function versionQuery(version?: string): string {
  return version ? `?version=${encodeURIComponent(version)}` : "";
}

function modelUrl(ref: RegistryModelRef): string {
  return `${modelsBaseUrl(ref.workspace, ref.registry)}/${encodeURIComponent(
    ref.model,
  )}${versionQuery(ref.version)}`;
}

export async function fetchRegistryModel(
  ref: RegistryModelRef,
  signal?: AbortSignal,
): Promise<RegistryModelVersion> {
  const res = await fetch(modelUrl(ref), { headers: authHeaders(), signal });

  if (!res.ok) {
    throw await errorFrom(res);
  }

  return (await res.json()) as RegistryModelVersion;
}

/** A model card, exactly as the registry stores it. */
export type RegistryModelReadme = {
  /** Markdown source. Never HTML: the server does not render it, and neither
   * does anything between here and the screen — see ModelReadme. */
  content: string;
  /** Whether the server stopped reading at its size cap. */
  truncated: boolean;
};

/**
 * Reads a model's card.
 *
 * Whether a registry serves cards at all is a capability, not a property of
 * public versus private: a registry that serves none refuses with
 * `not_supported`, and one that serves them but has none for this model answers
 * `not_found`. Both are answers about the registry and are left for the caller
 * to render as such.
 */
export async function fetchRegistryModelReadme(
  ref: RegistryModelRef,
  signal?: AbortSignal,
): Promise<RegistryModelReadme> {
  const res = await fetch(
    `${modelsBaseUrl(ref.workspace, ref.registry)}/${encodeURIComponent(
      ref.model,
    )}/readme${versionQuery(ref.version)}`,
    { headers: authHeaders(), signal },
  );

  if (!res.ok) {
    throw await errorFrom(res);
  }

  return {
    content: await res.text(),
    truncated: res.headers.get("X-Neutree-Content-Truncated") === "true",
  };
}

export type PatchRegistryModelBody = {
  /** Omit to leave the alias alone; an empty string removes it. */
  alias?: string;
  /**
   * The complete set of hand-filled fields. It replaces the recorded set
   * wholesale, so omitting a field that was filled in before removes it.
   */
  info?: ModelInfo;
};

export async function patchRegistryModel(
  ref: RegistryModelRef,
  body: PatchRegistryModelBody,
): Promise<RegistryModelVersion> {
  const res = await fetch(modelUrl(ref), {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw await errorFrom(res);
  }

  return (await res.json()) as RegistryModelVersion;
}

export async function deleteRegistryModel(
  ref: RegistryModelRef,
): Promise<void> {
  const res = await fetch(modelUrl(ref), {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw await errorFrom(res);
  }
}
