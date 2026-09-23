import type { UpstreamSpec } from "../types";

export function getUpstreamModelRequest(
  upstream: UpstreamSpec | undefined,
  workspace: string,
  saved?: { name: string; url: string },
) {
  if (upstream?.endpoint_ref) {
    return { endpoint_ref: upstream.endpoint_ref, workspace };
  }
  const url = upstream?.upstream?.url?.trim();
  if (!url) return undefined;
  return {
    upstream: { url },
    auth: { type: "bearer", credential: upstream?.auth?.credential ?? "" },
    workspace,
    ...(saved ? { name: saved.name, stored_upstream_url: saved.url } : {}),
  };
}
