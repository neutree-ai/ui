import type { ApiKey } from "@/domains/api-key/types";

/** The one-time secret of a just-created key, or null when the response has none to show or copy. */
export const createdKeySecret = (key: ApiKey): string | null =>
  key.status?.sk_value || null;
