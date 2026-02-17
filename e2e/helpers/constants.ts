/** Timeout for tests that create a test user (user + role + policy + login) */
export const MULTI_USER_TIMEOUT = 60_000;

/** Extended multi-user timeout for tests with extra setup (e.g. multiple users or complex flows) */
export const MULTI_USER_EXTENDED_TIMEOUT = 90_000;

/** Timeout for waiting for async UI state changes (API calls, lazy loading) */
export const ASYNC_UI_TIMEOUT = 10_000;

/** Timeout for waiting for a resource to disappear after deletion (finalizer delay) */
export const DELETE_TIMEOUT = 30_000;

/** Timeout for bulk/heavy operations (select-all resource fetch, YAML generation) */
export const BULK_TIMEOUT = 30_000;
