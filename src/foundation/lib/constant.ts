export const PRIVATE_MODEL_REGISTRY_TYPE = "bentoml";

/**
 * Polling for resource lists. Resources are created and deleted asynchronously
 * by controllers, so a list that only refetches on mutation keeps showing rows
 * the backend has already reconciled away. Every list surface polls instead.
 */
export const LIST_POLL_QUERY_OPTIONS = {
  refetchInterval: 3_000,
  refetchIntervalInBackground: true,
} as const;
