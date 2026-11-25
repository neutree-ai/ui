import { describe, expect, it } from "vitest";
import type { Role } from "@/domains/role/types";
import { fieldValue } from "@/foundation/testing/detail-fields";
import { roleHeaderFields } from "./detail-fields";

const role = (preset_key: Role["spec"]["preset_key"]) =>
  ({ spec: { preset_key, permissions: ["a", "b"] } }) as Role;

describe("roleHeaderFields", () => {
  it.each([
    { preset: "admin" as const, type: "roles.fields.presetRole" },
    { preset: null, type: "roles.fields.customRole" },
  ])("types preset $preset as $type", ({ preset, type }) => {
    expect(fieldValue(roleHeaderFields, "type", role(preset))).toBe(type);
  });

  it("counts the permissions", () => {
    expect(fieldValue(roleHeaderFields, "permissions", role(null))).toBe(
      "common.fields.permissionsCount:2",
    );
  });
});
