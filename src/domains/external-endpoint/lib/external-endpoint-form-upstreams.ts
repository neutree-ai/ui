import type { UpstreamType } from "@/domains/external-endpoint/lib/derive-upstream-type";
import type { UpstreamSpec } from "@/domains/external-endpoint/types";
import type { BaseStatus } from "@/foundation/types/basic-types";

/** A new external upstream: bearer auth, empty URL and credential, no mapping. */
export const blankExternalUpstream = (): UpstreamSpec => ({
  upstream: { url: "" },
  auth: { type: "bearer", credential: "" },
  model_mapping: {},
  models: null,
});

/** The quick-create dialog's upstream: an internal endpoint, or a URL with a bearer credential. */
export function quickUpstream(
  type: UpstreamType,
  input: { url: string; endpointRef: string; credential: string },
): UpstreamSpec {
  const upstream = blankExternalUpstream();
  if (type === "endpoint_ref") {
    upstream.upstream = null;
    upstream.endpoint_ref = input.endpointRef;
    upstream.auth = null;
  } else {
    upstream.upstream = { url: input.url };
    upstream.auth = { type: "bearer", credential: input.credential };
  }
  return upstream;
}

/** The first `provider-N` not in use. */
function nextProviderName(usedNames: Set<string | undefined>) {
  let index = 1;
  while (usedNames.has(`provider-${index}`)) index++;
  return `provider-${index}`;
}

/** A new upstream's name: the first `provider-N` no row's stored or current name uses. */
export const newUpstreamName = (
  storedNames: string[],
  upstreams: UpstreamSpec[] | undefined,
) =>
  nextProviderName(
    new Set([
      ...storedNames,
      ...(upstreams ?? []).map((upstream) => upstream.name),
    ]),
  );

/** An upstream's current name, trimmed; "" while blank. */
export const upstreamName = (upstream: UpstreamSpec | undefined) =>
  upstream?.name?.trim() || "";

/** The label a route target shows for an upstream row: its current name, else the stored one. */
export const routeUpstreamLabel = (
  upstream: UpstreamSpec | undefined,
  storedName: string,
) => upstream?.name || storedName;

/** Names the quick-create dialog refuses: every row's stored and current name. */
export const takenUpstreamNames = (
  storedNames: string[],
  upstreams: UpstreamSpec[] | undefined,
) => [...storedNames, ...(upstreams ?? []).map(upstreamName)];

/** Whether an upstream name (already trimmed) is blank or repeated. */
export const hasInvalidUpstreamNames = (names: string[]) =>
  names.some((name) => !name) || new Set(names).size !== names.length;

/** The reference a form row keeps until submit: its name and URL as first loaded. */
export const upstreamReference = (upstream: UpstreamSpec) => ({
  name: upstream.name ?? "",
  url: upstream.upstream?.url ?? "",
});

/**
 * Gives each unnamed legacy upstream a `provider-N` name once; a row with a
 * stored name keeps it. Unchanged entries are returned as the same objects.
 */
export function nameUnnamedUpstreams(
  upstreams: UpstreamSpec[],
  storedNames: (string | undefined)[],
) {
  const usedNames = new Set(
    upstreams.map((upstream) => upstream.name).filter(Boolean),
  );
  return upstreams.map((upstream, index) => {
    if (storedNames[index] || upstream.name) return upstream;
    const name = nextProviderName(usedNames);
    usedNames.add(name);
    return { ...upstream, name };
  });
}

type EndpointRefItem = { metadata: { name: string }; status?: BaseStatus };

/** Internal endpoints offered as references, Running first; a status is kept only when it has a phase. */
export const endpointRefOptions = (items: EndpointRefItem[]) =>
  items
    .map((item) => ({
      label: item.metadata.name,
      value: item.metadata.name,
      status: item.status?.phase ? item.status : undefined,
    }))
    .sort(
      (a, b) =>
        (a.status?.phase === "Running" ? 0 : 1) -
        (b.status?.phase === "Running" ? 0 : 1),
    );
