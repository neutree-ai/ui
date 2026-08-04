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

export type RegistryModelsQuery = {
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
};

/** The error bodies these routes answer with. Every field is optional: which
 * ones arrive depends on why the call failed. */
export type RegistryModelErrorBody = {
  message?: string;
  /** Present on a rejected delete; MODEL_REFERENCED_CODE when it was blocked. */
  code?: string;
  hint?: string;
  /** What still references the model, on a rejected delete. */
  references?: ModelReference[];
  /** What already holds the alias, on a 409. */
  conflict?: ModelAliasConflict;
};

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
}

function modelsBaseUrl(workspace: string, registry: string): string {
  return `${REST_URL}/workspaces/${encodeURIComponent(
    workspace,
  )}/model_registries/${encodeURIComponent(registry)}/models`;
}

/** Builds the listing URL. Exported for the callers that pass it to refine's
 * `useCustom`, which takes a URL relative to REST_URL. */
export function registryModelsPath(query: RegistryModelsQuery): string {
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

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const auth = clientPostgrest.headers.Authorization;

  if (typeof auth === "string" && auth) {
    headers.Authorization = auth;
  }

  return headers;
}

async function errorFrom(res: Response): Promise<RegistryModelError> {
  let body: RegistryModelErrorBody = {};

  try {
    body = (await res.json()) as RegistryModelErrorBody;
  } catch {
    // A body that is not JSON leaves us with the status alone.
  }

  if (!body.message) {
    body = { ...body, message: res.statusText };
  }

  return new RegistryModelError(res.status, body);
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

  // The body is a bare array; the count lives in the header.
  const models = (await res.json()) as RegistryModel[] | null;

  return {
    models: models ?? [],
    total: parseContentRangeTotal(res.headers.get("Content-Range")),
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
