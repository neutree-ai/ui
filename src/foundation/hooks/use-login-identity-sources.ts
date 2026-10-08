import { useCustom } from "@refinedev/core";
import {
  LOGIN_IDENTITY_SOURCES_PATH,
  type LoginIdentitySource,
  normalizeLoginIdentitySources,
} from "@/foundation/lib/api/identity-sources";

/**
 * The enabled identity sources for the login page, split by type. A failed
 * fetch leaves both lists empty: local login must keep working regardless.
 */
export const useLoginIdentitySources = () => {
  const { data, isLoading } = useCustom<LoginIdentitySource[]>({
    url: LOGIN_IDENTITY_SOURCES_PATH,
    method: "get",
    errorNotification: false,
    queryOptions: {
      retry: false,
      staleTime: 60 * 1000,
    },
  });

  const sources = normalizeLoginIdentitySources(data?.data);

  return {
    isLoading,
    ldapSources: sources.filter((s) => s.type === "ldap"),
    oidcSources: sources.filter((s) => s.type === "oidc"),
  };
};
