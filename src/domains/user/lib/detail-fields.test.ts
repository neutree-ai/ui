import { describe, expect, it } from "vitest";
import type { UserProfile } from "@/domains/user/types";
import { IDENTITY_SOURCE_NAME_LABEL } from "@/foundation/role/user-identity";
import { fieldValue } from "@/foundation/testing/detail-fields";
import { userHeaderFields } from "./detail-fields";

const user = (labels: Record<string, string>) =>
  ({ metadata: { name: "ada", labels }, spec: {} }) as UserProfile;

describe("userHeaderFields", () => {
  it.each([
    {
      labels: { [IDENTITY_SOURCE_NAME_LABEL]: "corp-ldap" },
      shown: "corp-ldap",
    },
    {
      labels: {} as Record<string, string>,
      shown: "user_profiles.values.local",
    },
  ])("names the identity source $shown", ({ labels, shown }) => {
    expect(fieldValue(userHeaderFields, "identitySource", user(labels))).toBe(
      shown,
    );
  });
});
