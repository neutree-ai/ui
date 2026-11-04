import { describe, expect, it } from "vitest";
import type { GroupUsageRecord } from "@/domains/api-key/types";
import { summarizeUsage, usageByApplication } from "./usage-summary";

const row = (
  name: string,
  usage: number,
  display_name: string | null = null,
): GroupUsageRecord => ({
  date: "2026-11-05",
  kind: "ServiceAccount",
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

  it("keeps only the named rows", () => {
    const summary = summarizeUsage([row("a", 10), row("b", 30)], "a");
    expect(summary.tokens).toBe(10);
    expect(summary.models).toHaveLength(1);
  });
});
