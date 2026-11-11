// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { i18n } from "@/foundation/lib/i18n";

describe("subject policy copy", () => {
  it("counts allowed models in the singular and the plural", () => {
    const t = i18n.getFixedT("en-US");
    expect(t("group_policies.subject.modelsAllowed", { count: 1 })).toBe(
      "1 model allowed",
    );
    expect(t("group_policies.subject.modelsAllowed", { count: 3 })).toBe(
      "3 models allowed",
    );
  });
});
