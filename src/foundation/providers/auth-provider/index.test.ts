import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks -----------------------------------------------------------

const mockSignInWithOAuth = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock("@supabase/auth-js", () => ({
  AuthClient: class {
    signInWithOAuth = mockSignInWithOAuth;
    signInWithPassword = mockSignInWithPassword;
    signUp = mockSignUp;
    resetPasswordForEmail = mockResetPasswordForEmail;
    updateUser = mockUpdateUser;
    signOut = mockSignOut;
    getSession = mockGetSession;
    getUser = mockGetUser;
    onAuthStateChange = mockOnAuthStateChange;
  },
}));

vi.mock("@/foundation/lib/api", () => ({
  REST_URL: "http://localhost/api/v1",
  clientPostgrest: { headers: {} },
}));

// --- Import after mocks ----------------------------------------------

const { authProvider } = await import("./index");

// --- Helpers ---------------------------------------------------------

const authError = { message: "auth error", name: "AuthApiError" };

beforeEach(() => {
  vi.clearAllMocks();
});

// --- login -----------------------------------------------------------

describe("login", () => {
  it("calls signInWithOAuth when providerName is given", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://oauth.example.com" },
      error: null,
    });

    const result = await authProvider.login({ providerName: "github" });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({ provider: "github" });
    expect(result).toEqual({ success: true });
  });

  it("returns error when signInWithOAuth fails", async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: null, error: authError });

    const result = await authProvider.login({ providerName: "github" });

    expect(result).toEqual({ success: false, error: authError });
  });

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
      error: { message: "Login failed", name: "Invalid email or password" },
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

// --- register --------------------------------------------------------

describe("register", () => {
  it("calls signUp and returns success", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const result = await authProvider.register?.({
      email: "a@b.com",
      password: "pass",
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pass",
      options: { data: {} },
    });
    expect(result).toEqual({ success: true });
  });

  it("returns error when signUp fails", async () => {
    mockSignUp.mockResolvedValue({ data: null, error: authError });

    const result = await authProvider.register?.({
      email: "a@b.com",
      password: "pass",
    });

    expect(result).toEqual({ success: false, error: authError });
  });

  it("returns fallback error when no data", async () => {
    mockSignUp.mockResolvedValue({ data: null, error: null });

    const result = await authProvider.register?.({
      email: "a@b.com",
      password: "pass",
    });

    expect(result).toEqual({
      success: false,
      error: { message: "Register failed", name: "Invalid email or password" },
    });
  });

  it("catches thrown exceptions", async () => {
    const thrown = new Error("network");
    mockSignUp.mockRejectedValue(thrown);

    const result = await authProvider.register?.({
      email: "a@b.com",
      password: "pass",
    });

    expect(result).toEqual({ success: false, error: thrown });
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
  it("returns user with name set to email", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com" } },
    });

    const result = await authProvider.getIdentity?.({});

    expect(result).toEqual({ id: "u1", email: "a@b.com", name: "a@b.com" });
  });

  it("returns null when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await authProvider.getIdentity?.({});

    expect(result).toBeNull();
  });
});
