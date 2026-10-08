import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks -----------------------------------------------------------

const mockSignInWithPassword = vi.fn();
const mockSetSession = vi.fn();
const mockVerifyOtp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock("@supabase/auth-js", () => ({
  AuthClient: class {
    signInWithPassword = mockSignInWithPassword;
    setSession = mockSetSession;
    verifyOtp = mockVerifyOtp;
    resetPasswordForEmail = mockResetPasswordForEmail;
    updateUser = mockUpdateUser;
    signOut = mockSignOut;
    getSession = mockGetSession;
    getUser = mockGetUser;
    onAuthStateChange = mockOnAuthStateChange;
  },
}));

const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
}));

vi.mock("@/foundation/lib/api", () => ({
  REST_URL: "http://localhost/api/v1",
  clientPostgrest: { headers: {}, from: mockFrom },
}));

vi.mock("@/foundation/lib/i18n", () => ({
  i18n: { t: (key: string) => key },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// --- Import after mocks ----------------------------------------------

const { authProvider, verifySsoToken } = await import("./index");

// --- Helpers ---------------------------------------------------------

const authError = { message: "auth error", name: "AuthApiError" };

beforeEach(() => {
  vi.clearAllMocks();
});

// --- login -----------------------------------------------------------

describe("login", () => {
  it("calls signInWithPassword for email/password login", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    const result = await authProvider.login({
      email: "a@b.com",
      password: "pass",
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pass",
    });
    expect(result).toEqual({ success: true });
  });

  it("returns error when signInWithPassword fails", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: null, error: authError });

    const result = await authProvider.login({
      email: "a@b.com",
      password: "wrong",
    });

    expect(result).toEqual({ success: false, error: authError });
  });

  it("returns fallback error when no user is returned", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await authProvider.login({
      email: "a@b.com",
      password: "pass",
    });

    expect(result).toEqual({
      success: false,
      error: {
        message: "Login failed",
        name: "Invalid username/email or password",
      },
    });
  });

  it("catches thrown exceptions", async () => {
    const thrown = new Error("network");
    mockSignInWithPassword.mockRejectedValue(thrown);

    const result = await authProvider.login({
      email: "a@b.com",
      password: "pass",
    });

    expect(result).toEqual({ success: false, error: thrown });
  });
});

// --- LDAP login --------------------------------------------------------

describe("login with LDAP", () => {
  const ldapParams = {
    method: "ldap",
    source: "corp-ldap",
    username: "alice",
    password: "secret",
  };

  const jsonResponse = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  it("posts the credentials and stores the returned session", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(200, {
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
        user: { id: "u1" },
      }),
    );
    mockSetSession.mockResolvedValue({ data: {}, error: null });

    const result = await authProvider.login(ldapParams);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/api/v1/auth/ldap/token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          source: "corp-ldap",
          username: "alice",
          password: "secret",
        }),
      }),
    );
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "at",
      refresh_token: "rt",
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it.each([
    [401, "pages.login.errors.invalidCredentials"],
    [404, "pages.login.errors.sourceNotFound"],
    [503, "pages.login.errors.directoryUnavailable"],
    [500, "pages.login.errors.ldapFailed"],
    [400, "pages.login.errors.ldapFailed"],
  ])("maps HTTP %i to %s without storing a session", async (status, key) => {
    mockFetch.mockResolvedValue(jsonResponse(status, { error: "x" }));

    const result = await authProvider.login(ldapParams);

    expect(result).toEqual({
      success: false,
      error: { name: "pages.login.errors.title", message: key },
    });
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it("fails when the response carries no session", async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, {}));

    const result = await authProvider.login(ldapParams);

    expect(result.success).toBe(false);
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it("returns the auth client error when the session cannot be stored", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(200, { access_token: "at", refresh_token: "rt" }),
    );
    mockSetSession.mockResolvedValue({ data: {}, error: authError });

    const result = await authProvider.login(ldapParams);

    expect(result).toEqual({ success: false, error: authError });
  });

  it("reports a network failure as a failed login", async () => {
    const thrown = new Error("network");
    mockFetch.mockRejectedValue(thrown);

    const result = await authProvider.login(ldapParams);

    expect(result).toEqual({ success: false, error: thrown });
  });
});

// --- SSO token -----------------------------------------------------------

describe("verifySsoToken", () => {
  it("redeems the token as a magic link", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: { access_token: "at" } },
      error: null,
    });

    const result = await verifySsoToken("hash-1");

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-1",
      type: "magiclink",
    });
    expect(result).toEqual({ success: true });
  });

  it("fails on an error or a missing session", async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: authError,
    });
    expect(await verifySsoToken("used")).toEqual({ success: false });

    mockVerifyOtp.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    expect(await verifySsoToken("odd")).toEqual({ success: false });
  });
});

// --- forgotPassword --------------------------------------------------

describe("forgotPassword", () => {
  it("calls resetPasswordForEmail and returns success", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const result = await authProvider.forgotPassword?.({ email: "a@b.com" });

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("a@b.com", {
      redirectTo: expect.stringContaining("/update-password"),
    });
    expect(result).toEqual({ success: true });
  });

  it("returns error when resetPasswordForEmail fails", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: null,
      error: authError,
    });

    const result = await authProvider.forgotPassword?.({ email: "a@b.com" });

    expect(result).toEqual({ success: false, error: authError });
  });

  it("returns fallback error when no data", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: null, error: null });

    const result = await authProvider.forgotPassword?.({ email: "a@b.com" });

    expect(result).toEqual({
      success: false,
      error: { message: "Forgot password failed", name: "Invalid email" },
    });
  });

  it("catches thrown exceptions", async () => {
    const thrown = new Error("network");
    mockResetPasswordForEmail.mockRejectedValue(thrown);

    const result = await authProvider.forgotPassword?.({ email: "a@b.com" });

    expect(result).toEqual({ success: false, error: thrown });
  });
});

// --- updatePassword --------------------------------------------------

describe("updatePassword", () => {
  it("calls updateUser and returns success with redirect", async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    const result = await authProvider.updatePassword?.({ password: "new123" });

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "new123" });
    expect(result).toEqual({ success: true, redirectTo: "/" });
  });

  it("returns error when updateUser fails", async () => {
    mockUpdateUser.mockResolvedValue({ data: null, error: authError });

    const result = await authProvider.updatePassword?.({ password: "new123" });

    expect(result).toEqual({ success: false, error: authError });
  });

  it("returns fallback error when no data", async () => {
    mockUpdateUser.mockResolvedValue({ data: null, error: null });

    const result = await authProvider.updatePassword?.({ password: "new123" });

    expect(result).toEqual({
      success: false,
      error: { message: "Update password failed", name: "Invalid password" },
    });
  });

  it("catches thrown exceptions", async () => {
    const thrown = new Error("network");
    mockUpdateUser.mockRejectedValue(thrown);

    const result = await authProvider.updatePassword?.({ password: "new123" });

    expect(result).toEqual({ success: false, error: thrown });
  });
});

// --- logout ----------------------------------------------------------

describe("logout", () => {
  it("calls signOut and returns success with redirect", async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const result = await authProvider.logout({});

    expect(mockSignOut).toHaveBeenCalledWith({});
    expect(result).toEqual({ success: true, redirectTo: "/login" });
  });

  it("returns error when signOut fails", async () => {
    mockSignOut.mockResolvedValue({ error: authError });

    const result = await authProvider.logout({});

    expect(result).toEqual({ success: false, error: authError });
  });
});

// --- onError ---------------------------------------------------------

describe("onError", () => {
  it("returns logout for PGRST301", async () => {
    const result = await authProvider.onError({ code: "PGRST301" });
    expect(result).toEqual({ logout: true });
  });

  it("returns logout for 401", async () => {
    const result = await authProvider.onError({ code: 401 });
    expect(result).toEqual({ logout: true });
  });

  it("passes through other errors", async () => {
    const error = { code: "OTHER", message: "something" };
    const result = await authProvider.onError(error);
    expect(result).toEqual({ error });
  });
});

// --- check -----------------------------------------------------------

describe("check", () => {
  it("returns authenticated when session and user exist", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "tok123" } },
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
    });

    const result = await authProvider.check({});

    expect(result).toEqual({ authenticated: true });
  });

  it("returns unauthenticated when no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const result = await authProvider.check({});

    expect(result).toEqual({
      authenticated: false,
      error: { message: "Check failed", name: "Session not found" },
      logout: true,
      redirectTo: "/login",
    });
  });

  it("returns unauthenticated when no user", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "tok" } },
    });
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await authProvider.check({});

    expect(result).toEqual({
      authenticated: false,
      error: { message: "Check failed", name: "Session not found" },
      logout: true,
      redirectTo: "/login",
    });
  });

  it("returns unauthenticated on exception", async () => {
    const thrown = new Error("network");
    mockGetSession.mockRejectedValue(thrown);

    const result = await authProvider.check({});

    expect(result).toEqual({
      authenticated: false,
      error: thrown,
      logout: true,
      redirectTo: "/login",
    });
  });
});

// --- getPermissions --------------------------------------------------

describe("getPermissions", () => {
  it("returns user role", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { role: "admin" } },
    });

    const result = await authProvider.getPermissions?.({});

    expect(result).toBe("admin");
  });

  it("returns null when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await authProvider.getPermissions?.({});

    expect(result).toBeUndefined();
  });
});

// --- getIdentity -----------------------------------------------------

describe("getIdentity", () => {
  it("names a local user by the profile display name", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "admin@neutree.local",
          user_metadata: { username: "admin" },
        },
      },
    });
    mockMaybeSingle.mockResolvedValue({
      data: { metadata: { name: "admin", display_name: "Administrator" } },
    });

    const result = await authProvider.getIdentity?.({});

    expect(result).toMatchObject({
      id: "u1",
      name: "Administrator",
      displayEmail: "admin@neutree.local",
      external: false,
    });
  });

  it("shows an external user's real email, never the placeholder", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "u2",
          email: "abc@corp-ldap.ldap.neutree.local",
          app_metadata: { identity_source: "ldap" },
          user_metadata: { name: "Alice Liddell", email: "alice@corp.test" },
        },
      },
    });
    mockMaybeSingle.mockResolvedValue({ data: null });

    const result = await authProvider.getIdentity?.({});

    expect(result).toMatchObject({
      name: "Alice Liddell",
      displayEmail: "alice@corp.test",
      external: true,
    });
  });

  it("falls back to GoTrue metadata when the profile read fails", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "u3", email: "x@y.z", user_metadata: { username: "x" } },
      },
    });
    mockMaybeSingle.mockRejectedValue(new Error("network"));

    const result = await authProvider.getIdentity?.({});

    expect(result).toMatchObject({ name: "x", displayEmail: "x@y.z" });
  });

  it("returns null when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await authProvider.getIdentity?.({});

    expect(result).toBeNull();
  });
});
