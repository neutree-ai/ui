/**
 * The OIDC login returns to the UI with its result in the URL fragment:
 * `#token_hash=…&type=magiclink` on success or `#error=<code>` on failure.
 *
 * The UI uses a hash router and the server has no SPA fallback, so the return
 * address is the page the UI is served from (no route of its own). Before the
 * router starts, `captureSsoCallback` takes the result out of the fragment,
 * keeps it in memory and rewrites the address to the callback route, so the
 * one-time token never stays in the address bar or the history.
 */

export const SSO_CALLBACK_ROUTE = "/sso/callback";

type SsoCallbackResult =
  | { kind: "token"; tokenHash: string }
  | { kind: "error"; code: string };

const SSO_CALLBACK_HASH = `#${SSO_CALLBACK_ROUTE}`;

/**
 * Reads an SSO result from a location hash. Accepts the bare fragment the
 * server appends (`#token_hash=…`) and the same fragment behind the callback
 * route (`#/sso/callback#error=…`). Anything else is not an SSO result.
 */
export function parseSsoCallbackHash(hash: string): SsoCallbackResult | null {
  let fragment: string;
  if (hash.startsWith(`${SSO_CALLBACK_HASH}#`)) {
    fragment = hash.slice(SSO_CALLBACK_HASH.length + 1);
  } else if (hash.startsWith("#") && !hash.startsWith("#/")) {
    fragment = hash.slice(1);
  } else {
    return null;
  }

  const params = new URLSearchParams(fragment);
  const error = params.get("error");
  if (error) {
    return { kind: "error", code: error };
  }

  const tokenHash = params.get("token_hash");
  if (tokenHash && params.get("type") === "magiclink") {
    return { kind: "token", tokenHash };
  }

  return null;
}

let captured: SsoCallbackResult | null = null;

/**
 * Moves an SSO result out of the address bar into memory and points the hash
 * router at the callback route. Returns whether there was one.
 */
export function captureSsoCallback(
  location: Pick<Location, "hash" | "pathname" | "search"> = window.location,
  history: Pick<History, "replaceState"> = window.history,
): boolean {
  const result = parseSsoCallbackHash(location.hash);
  if (!result) {
    return false;
  }

  captured = result;
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}${SSO_CALLBACK_HASH}`,
  );
  return true;
}

/** The captured SSO result, or null when the page was opened without one. */
export function getCapturedSsoCallback(): SsoCallbackResult | null {
  return captured;
}

export function clearCapturedSsoCallback() {
  captured = null;
}

/** The address the identity provider login returns to: the UI's own page. */
export function ssoRedirectTarget(
  location: Pick<Location, "origin" | "pathname"> = window.location,
): string {
  return `${location.origin}${location.pathname}`;
}

const POST_LOGIN_PATH_KEY = "neutree.sso.postLoginPath";

/**
 * Accepts only an in-app route ("/x"), never a protocol-relative or absolute
 * URL, so a crafted `to` cannot send the user off-site after login.
 */
export function sanitizePostLoginPath(path: unknown): string | null {
  if (typeof path !== "string" || !path.startsWith("/")) {
    return null;
  }
  if (path.startsWith("//") || path.startsWith("/\\")) {
    return null;
  }
  if (path === SSO_CALLBACK_ROUTE || path.startsWith("/login")) {
    return null;
  }
  return path;
}

/** Remembers where to go after an SSO login that leaves the page. */
export function rememberPostLoginPath(path: unknown) {
  try {
    const safe = sanitizePostLoginPath(path);
    if (safe) {
      sessionStorage.setItem(POST_LOGIN_PATH_KEY, safe);
    } else {
      sessionStorage.removeItem(POST_LOGIN_PATH_KEY);
    }
  } catch {
    // Storage unavailable: the login still works, it just lands on home.
  }
}

/** Returns and forgets the remembered post-login path. */
export function takePostLoginPath(): string | null {
  try {
    const path = sessionStorage.getItem(POST_LOGIN_PATH_KEY);
    sessionStorage.removeItem(POST_LOGIN_PATH_KEY);
    return sanitizePostLoginPath(path);
  } catch {
    return null;
  }
}
