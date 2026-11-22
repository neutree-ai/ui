import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import type {
  IdentitySource,
  IdentitySourceLDAPSpec,
} from "@/domains/identity-source/types";
import type { DetailField } from "@/foundation/scene/DetailFields";
import {
  identitySourceLdapFields,
  identitySourceStateFields,
} from "./detail-fields";

const t = ((key: string) => key) as TFunction;

const shown = <T>(fields: DetailField<T>[], key: string, record: T) => {
  const field = fields.find((candidate) => candidate.key === key);
  if (!field || !("value" in field)) throw new Error(`no value field ${key}`);
  return field.value(record, t);
};

const withStatus = (status: IdentitySource["status"]) =>
  ({ status }) as IdentitySource;

describe("identitySourceStateFields", () => {
  it.each([
    { error: "bind failed", test: "timeout", message: "bind failed" },
    { error: "", test: "timeout", message: "timeout" },
    { error: null, test: null, message: null },
  ])("shows message $message for error $error and test $test", (row) => {
    const source = withStatus({
      error_message: row.error,
      last_connection_test: { ok: false, message: row.test },
    });

    expect(shown(identitySourceStateFields, "message", source)).toBe(
      row.message,
    );
  });
});

describe("identitySourceLdapFields", () => {
  it.each([
    { ca_cert: "PEM", label: "identity_sources.values.caConfigured" },
    { ca_cert: null, label: "identity_sources.values.systemTrust" },
  ])("labels CA $ca_cert as $label", ({ ca_cert, label }) => {
    const ldap = { ca_cert } as IdentitySourceLDAPSpec;

    expect(shown(identitySourceLdapFields, "caCert", ldap)).toBe(label);
  });

  it("reads unset TLS switches as off", () => {
    const ldap = { start_tls: null } as IdentitySourceLDAPSpec;

    expect(shown(identitySourceLdapFields, "startTls", ldap)).toBe(false);
    expect(shown(identitySourceLdapFields, "insecureSkipVerify", ldap)).toBe(
      false,
    );
  });
});
