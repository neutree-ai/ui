import { describe, expect, it } from "vitest";
import type { OrgUnit } from "@/domains/organization/types";
import { userDepartmentPath } from "./user-department";

const unit = (id: number, path: string, display: string): OrgUnit =>
  ({
    id,
    kind: "OrgUnit",
    metadata: { name: `ou-${id}`, display_name: display },
    path,
  }) as OrgUnit;

const rd = unit(1, "/1/", "R&D");
const ai = unit(2, "/1/2/", "AI");
const infer = unit(3, "/1/2/3/", "infer");
const byId = new Map([rd, ai, infer].map((u) => [u.id, u]));

describe("userDepartmentPath", () => {
  it("joins every department from the root down to the leaf", () => {
    expect(userDepartmentPath(infer, byId)).toBe("R&D / AI / infer");
  });

  it("skips ancestors the caller cannot read", () => {
    expect(userDepartmentPath(infer, new Map([[2, ai]]))).toBe("AI / infer");
    expect(userDepartmentPath(infer, new Map())).toBe("infer");
  });

  it("is empty for a user without a department", () => {
    expect(userDepartmentPath(undefined, byId)).toBe("");
  });
});
