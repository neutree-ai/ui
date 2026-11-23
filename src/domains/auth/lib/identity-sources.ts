import { REST_URL } from "@/foundation/lib/api";

/** An enabled identity source, as the public login endpoint lists it. */
export type LoginIdentitySource = {
  name: string;
  display_name: string;
  type: "ldap" | "oidc";
};

export const LOGIN_IDENTITY_SOURCES_PATH = "/auth/identity-sources";

/** Keeps well-formed entries only, so a bad row never breaks the login page. */
export function normalizeLoginIdentitySources(
  raw: unknown,
): LoginIdentitySource[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const { name, display_name, type } = item as Record<string, unknown>;
    if (typeof name !== "string" || name === "") {
      return [];
    }
    if (type !== "ldap" && type !== "oidc") {
      return [];
    }
    return [
      {
        name,
        display_name:
          typeof display_name === "string" && display_name.trim()
            ? display_name
            : name,
        type,
      },
    ];
  });
}

/** Where the browser goes to start an OIDC login with the given source. */
export function buildOidcAuthorizeUrl(
  sourceName: string,
  redirectTo: string,
  restUrl: string = REST_URL,
): string {
  const params = new URLSearchParams({
    source: sourceName,
    redirect_to: redirectTo,
  });
  return `${restUrl}/auth/oidc/authorize?${params.toString()}`;
}
