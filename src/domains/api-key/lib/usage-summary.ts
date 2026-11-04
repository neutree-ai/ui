import type { GroupUsageRecord } from "@/domains/api-key/types";

export type UsageTotal = {
  key: string;
  label: string;
  endpoint?: string;
  workspace?: string;
  requests: number;
  tokens: number;
};

/** Totals of the rows matching `name`, by model and endpoint. */
export function summarizeUsage(rows: GroupUsageRecord[], name?: string) {
  const byModel = new Map<string, UsageTotal>();
  let requests = 0;
  let tokens = 0;
  for (const row of rows) {
    if (name !== undefined && row.name !== name) continue;
    const rowRequests = Number(row.requests) || 0;
    const rowTokens = Number(row.usage) || 0;
    requests += rowRequests;
    tokens += rowTokens;
    const model = row.model_name ?? "-";
    const key = [row.workspace, row.endpoint_name, model].join("\0");
    const total = byModel.get(key) ?? {
      key,
      label: model,
      endpoint: row.endpoint_name,
      workspace: row.workspace,
      requests: 0,
      tokens: 0,
    };
    total.requests += rowRequests;
    total.tokens += rowTokens;
    byModel.set(key, total);
  }
  return {
    requests,
    tokens,
    models: [...byModel.values()].sort((a, b) => b.tokens - a.tokens),
  };
}

/** Totals per application (ServiceAccount usage rows). */
export function usageByApplication(rows: GroupUsageRecord[]): UsageTotal[] {
  const byName = new Map<string, UsageTotal>();
  for (const row of rows) {
    const total = byName.get(row.name) ?? {
      key: row.name,
      label: row.display_name || row.name,
      requests: 0,
      tokens: 0,
    };
    total.requests += Number(row.requests) || 0;
    total.tokens += Number(row.usage) || 0;
    byName.set(row.name, total);
  }
  return [...byName.values()].sort((a, b) => b.tokens - a.tokens);
}
