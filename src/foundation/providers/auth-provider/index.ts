import type { AuthProvider } from "@refinedev/core";
import { AuthClient } from "@supabase/auth-js";
import { clientPostgrest, REST_URL } from "@/foundation/lib/api";
import { i18n } from "@/foundation/lib/i18n";
import {
  authUserDisplayName,
  authUserEmail,
  isExternalUser,
} from "@/foundation/lib/user-identity";

const GOTRUE_URL = `${REST_URL}/auth`;

export const auth = new AuthClient({ url: GOTRUE_URL, autoRefreshToken: true });

auth.onAuthStateChange((_event, session) => {
  if (session?.access_token) {
    clientPostgrest.headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    delete clientPostgrest.headers.Authorization;
  }
});

export type LdapLoginParams = {
  method: "ldap";
  source?: string;
  username: string;
  password: string;
};

type AuthFailure = { success: false; error: Error };

const ldapFailure = (status: number): AuthFailure => {
  let key = "pages.login.errors.ldapFailed";
  if (status === 401) {
    key = "pages.login.errors.invalidCredentials";
  } else if (status === 404) {
    key = "pages.login.errors.sourceNotFound";
  } else if (status === 503) {
    key = "pages.login.errors.directoryUnavailable";
  }
  return {
    success: false,
    error: { name: i18n.t("pages.login.errors.title"), message: i18n.t(key) },
  };
};

/**
 * Logs in with directory credentials. The server answers with a GoTrue
 * session, which is handed to the auth client exactly as a password login
 * would store it, so refresh and logout work the same way.
 */
async function loginWithLdap({ source, username, password }: LdapLoginParams) {
  const res = await fetch(`${GOTRUE_URL}/ldap/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, username, password }),
  });

  if (!res.ok) {
    return ldapFailure(res.status);
  }

  const session = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!session?.access_token || !session.refresh_token) {
    return ldapFailure(0);
  }

  const { error } = await auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) {
    return { success: false as const, error };
  }

  return { success: true as const };
}

/**
 * Finishes an OIDC login: redeems the one-time token the callback received
 * for a session, which the auth client stores like any other.
 */
export async function verifySsoToken(tokenHash: string) {
  const { data, error } = await auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (error || !data?.session) {
    return { success: false as const };
  }
  return { success: true as const };
}

/** The signed-in user's own profile metadata, or null if unreadable. */
async function fetchOwnProfile(userId: string) {
  try {
    const { data } = await clientPostgrest
      .from("user_profiles")
      .select("metadata")
      .eq("id", userId)
      .maybeSingle();
    const metadata = data?.metadata as
      | { name?: string | null; display_name?: string | null }
      | null
      | undefined;
    if (!metadata?.name) {
      return null;
    }
    return { name: metadata.name, display_name: metadata.display_name };
  } catch {
    return null;
  }
}

export const authProvider: AuthProvider = {
  login: async (params) => {
    try {
      if (params?.method === "ldap") {
        return await loginWithLdap(params as LdapLoginParams);
      }

      const { email, password } = params ?? {};
      const { data, error } = await auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error,
        };
      }

      if (data?.user) {
        return {
          success: true,
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: error as Error,
      };
    }

    return {
      success: false,
      error: {
        message: "Login failed",
        name: "Invalid username/email or password",
      },
    };
  },
  forgotPassword: async ({ email }) => {
    try {
      const { data, error } = await auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        return {
          success: false,
          error,
        };
      }

      if (data) {
        return {
          success: true,
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: error as Error,
      };
    }

    return {
      success: false,
      error: {
        message: "Forgot password failed",
        name: "Invalid email",
      },
    };
  },
  updatePassword: async ({ password }) => {
    try {
      const { data, error } = await auth.updateUser({
        password,
      });

      if (error) {
        return {
          success: false,
          error,
        };
      }

      if (data) {
        return {
          success: true,
          redirectTo: "/",
        };
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: error as Error,
      };
    }
    return {
      success: false,
      error: {
        message: "Update password failed",
        name: "Invalid password",
      },
    };
  },
  logout: async () => {
    const { error } = await auth.signOut({});

    if (error) {
      return {
        success: false,
        error,
      };
    }

    return {
      success: true,
      redirectTo: "/login",
    };
  },
  onError: async (error) => {
    if (error?.code === "PGRST301" || error?.code === 401) {
      return {
        logout: true,
      };
    }

    return { error };
  },
  check: async () => {
    try {
      const {
        data: { session },
      } = await auth.getSession();
      const {
        data: { user },
      } = await auth.getUser();

      if (!session || !user) {
        return {
          authenticated: false,
          error: {
            message: "Check failed",
            name: "Session not found",
          },
          logout: true,
          redirectTo: "/login",
        };
      }

      clientPostgrest.headers.Authorization = `Bearer ${session.access_token}`;
    } catch (error: unknown) {
      return {
        authenticated: false,
        error: (error as Error) || {
          message: "Check failed",
          name: "Session not found",
        },
        logout: true,
        redirectTo: "/login",
      };
    }

    return {
      authenticated: true,
    };
  },
  getPermissions: async () => {
    const user = await auth.getUser();

    if (user) {
      return user.data.user?.role;
    }

    return null;
  },
  getIdentity: async () => {
    const { data } = await auth.getUser();

    if (data?.user) {
      const profile = await fetchOwnProfile(data.user.id);
      return {
        ...data.user,
        name: authUserDisplayName(data.user, profile),
        displayEmail: authUserEmail(data.user),
        external: isExternalUser(data.user),
      };
    }

    return null;
  },
};
