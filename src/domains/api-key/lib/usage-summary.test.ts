import { describe, expect, it } from "vitest";
import type { GroupUsageRecord } from "@/domains/api-key/types";
import {
  summarizeUsage,
  usageByApplication,
  usageByMember,
} from "./usage-summary";

const row = (
  name: string,
  usage: number,
  display_name: string | null = null,
  kind: GroupUsageRecord["kind"] = "ServiceAccount",
): GroupUsageRecord => ({
  date: "2026-11-05",
  kind,
  name,
  display_name,
  workspace: "default",
  endpoint_type: "external",
  endpoint_name: "ep",
  model_name: "m",
  requests: 1,
  usage,
  prompt_tokens: null,
  completion_tokens: null,
});

describe("usage summaries", () => {
  it("totals each application, largest first", () => {
    expect(
      usageByApplication([row("a", 10, "App A"), row("b", 30), row("a", 5)]),
    ).toEqual([
      { key: "b", label: "b", requests: 1, tokens: 30 },
      { key: "a", label: "App A", requests: 2, tokens: 15 },
    ]);
  });

  it("totals each member, skipping application rows", () => {
    expect(
      usageByMember([
        row("u1", 10, "Alice", "User"),
        row("sa", 99, "App", "ServiceAccount"),
        row("u1", 5, "Alice", "User"),
      ]),
    ).toEqual([{ key: "u1", label: "Alice", requests: 2, tokens: 15 }]);
  });

  it("keeps only the named rows", () => {
    const summary = summarizeUsage([row("a", 10), row("b", 30)], "a");
    expect(summary.tokens).toBe(10);
    expect(summary.models).toHaveLength(1);
  });
});
