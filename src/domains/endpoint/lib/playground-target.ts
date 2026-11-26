import type { Endpoint } from "@/domains/endpoint/types";

/** The endpoint's OpenAI-compatible base path behind the serve proxy, relative to the API root. */
export const playgroundServePath = (endpoint: Endpoint) =>
  `/serve-proxy/${endpoint.metadata.workspace}/${endpoint.metadata.name}/v1`;

/** Whether the endpoint is loaded far enough to address through the serve proxy. */
export const hasPlaygroundTarget = (endpoint?: Endpoint) =>
  Boolean(endpoint?.metadata?.name);
