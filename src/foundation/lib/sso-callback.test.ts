import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureSsoCallback,
  clearCapturedSsoCallback,
  getCapturedSsoCallback,
  parseSsoCallbackHash,
  rememberPostLoginPath,
  sanitizePostLoginPath,
  ssoRedirectTarget,
  takePostLoginPath,
} from "./sso-callback";

describe("parseSsoCallbackHash", () => {
  it("reads a magic link token from the bare fragment", () => {
    expect(parseSsoCallbackHash("#token_hash=abc%2B1&type=magiclink")).toEqual({
      kind: "token",
      tokenHash: "abc+1",
    });
  });

  it("reads an error code", () => {
    expect(parseSsoCallbackHash("#error=login_failed")).toEqual({
      kind: "error",
      code: "login_failed",
    });
  });

  it("reads a result behind the callback route", () => {
    expect(parseSsoCallbackHash("#/sso/callback#error=invalid_state")).toEqual({
      kind: "error",
      code: "invalid_state",
    });
  });

  it("ignores router paths and other fragments", () => {
    expect(parseSsoCallbackHash("")).toBeNull();
    expect(parseSsoCallbackHash("#/dashboard")).toBeNull();
    expect(parseSsoCallbackHash("#/sso/callback")).toBeNull();
    expect(parseSsoCallbackHash("#foo=bar")).toBeNull();
  });

  it("rejects a token of another type", () => {
    expect(parseSsoCallbackHash("#token_hash=abc&type=recovery")).toBeNull();
    expect(parseSsoCallbackHash("#token_hash=abc")).toBeNull();
  });
});

describe("captureSsoCallback", () => {
  beforeEach(() => clearCapturedSsoCallback());

  it("moves the token out of the address and points at the route", () => {
    const replaceState = vi.fn();
    const captured = captureSsoCallback(
      {
        hash: "#token_hash=t1&type=magiclink",
        pathname: "/",
        search: "",
      },
      { replaceState },
    );

    expect(captured).toBe(true);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/#/sso/callback");
    expect(getCapturedSsoCallback()).toEqual({
      kind: "token",
      tokenHash: "t1",
    });
  });

  it("leaves ordinary addresses alone", () => {
    const replaceState = vi.fn();
    const captured = captureSsoCallback(
      { hash: "#/login?to=%2Fx", pathname: "/", search: "" },
      { replaceState },
    );

    expect(captured).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
    expect(getCapturedSsoCallback()).toBeNull();
  });
});

describe("ssoRedirectTarget", () => {
  it("is the page the UI is served from, without a fragment", () => {
    expect(ssoRedirectTarget({ origin: "http://h:3000", pathname: "/" })).toBe(
      "http://h:3000/",
    );
  });
});

describe("post-login path", () => {
  beforeEach(() => sessionStorage.clear());

  it("accepts in-app routes only", () => {
    expect(sanitizePostLoginPath("/user-profiles")).toBe("/user-profiles");
    expect(sanitizePostLoginPath("//evil.example")).toBeNull();
    expect(sanitizePostLoginPath("/\\evil.example")).toBeNull();
    expect(sanitizePostLoginPath("https://evil.example")).toBeNull();
    expect(sanitizePostLoginPath("/login")).toBeNull();
    expect(sanitizePostLoginPath("/sso/callback")).toBeNull();
    expect(sanitizePostLoginPath(undefined)).toBeNull();
  });

  it("is returned once", () => {
    rememberPostLoginPath("/default/endpoints");
    expect(takePostLoginPath()).toBe("/default/endpoints");
    expect(takePostLoginPath()).toBeNull();
  });

  it("forgets an earlier path when the new one is unsafe", () => {
    rememberPostLoginPath("/a");
    rememberPostLoginPath("//evil.example");
    expect(takePostLoginPath()).toBeNull();
  });
});
