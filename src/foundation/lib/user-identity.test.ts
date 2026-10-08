import { describe, expect, it } from "vitest";
import {
  authUserDisplayName,
  authUserEmail,
  IDENTITY_SOURCE_LABEL,
  identitySourceOf,
  isExternalUser,
  profileDisplayName,
  profileIdentitySource,
  profileOptionLabel,
} from "./user-identity";

describe("profileDisplayName", () => {
  it("prefers the display name", () => {
    expect(profileDisplayName({ name: "alice", display_name: "Alice" })).toBe(
      "Alice",
    );
  });

  it("falls back to the name when the display name is unset or blank", () => {
    expect(profileDisplayName({ name: "alice" })).toBe("alice");
    expect(profileDisplayName({ name: "alice", display_name: null })).toBe(
      "alice",
    );
    expect(profileDisplayName({ name: "alice", display_name: "" })).toBe(
      "alice",
    );
    expect(profileDisplayName({ name: "alice", display_name: "  " })).toBe(
      "alice",
    );
  });
});

describe("profileOptionLabel", () => {
  it("adds the unique name when it differs", () => {
    expect(
      profileOptionLabel({ name: "zhang-san", display_name: "张三" }),
    ).toBe("张三 (zhang-san)");
  });

  it("shows the name alone when there is nothing to add", () => {
    expect(profileOptionLabel({ name: "admin", display_name: "admin" })).toBe(
      "admin",
    );
    expect(profileOptionLabel({ name: "admin", display_name: "" })).toBe(
      "admin",
    );
  });
});

const ldapUser = {
  email: "0a1b@corp-ldap.ldap.neutree.local",
  app_metadata: { identity_source: "ldap" },
  user_metadata: {
    name: "Alice Liddell",
    preferred_username: "alice",
    email: "alice@corp.test",
  },
};

describe("external users", () => {
  it("are recognised by app_metadata.identity_source", () => {
    expect(identitySourceOf(ldapUser)).toBe("ldap");
    expect(isExternalUser(ldapUser)).toBe(true);
    expect(isExternalUser({ email: "a@b.c", app_metadata: {} })).toBe(false);
    expect(isExternalUser(null)).toBe(false);
  });

  it("show the directory email, never the placeholder", () => {
    expect(authUserEmail(ldapUser)).toBe("alice@corp.test");
    expect(
      authUserEmail({ ...ldapUser, user_metadata: { name: "Alice" } }),
    ).toBe("");
  });

  it("local users show their GoTrue email", () => {
    expect(authUserEmail({ email: "admin@neutree.local" })).toBe(
      "admin@neutree.local",
    );
  });
});

describe("authUserDisplayName", () => {
  it("prefers the profile display name", () => {
    expect(
      authUserDisplayName(ldapUser, {
        name: "alice",
        display_name: "Alice L.",
      }),
    ).toBe("Alice L.");
  });

  it("falls back through the GoTrue names to the email", () => {
    expect(authUserDisplayName(ldapUser)).toBe("Alice Liddell");
    expect(
      authUserDisplayName({
        email: "admin@neutree.local",
        user_metadata: { username: "admin" },
      }),
    ).toBe("admin");
    expect(
      authUserDisplayName({
        ...ldapUser,
        user_metadata: { preferred_username: "kc.alice" },
      }),
    ).toBe("kc.alice");
    expect(authUserDisplayName({ email: "x@y.z" })).toBe("x@y.z");
  });

  it("never falls back to an external placeholder email", () => {
    expect(authUserDisplayName({ ...ldapUser, user_metadata: {} })).toBe("");
  });
});

describe("profileIdentitySource", () => {
  it("reads the identity source label", () => {
    expect(
      profileIdentitySource({ labels: { [IDENTITY_SOURCE_LABEL]: "oidc" } }),
    ).toBe("oidc");
  });

  it("is empty for local users and missing labels", () => {
    expect(profileIdentitySource({ labels: { team: "a" } })).toBe("");
    expect(profileIdentitySource({ labels: null })).toBe("");
    expect(profileIdentitySource(undefined)).toBe("");
  });
});
