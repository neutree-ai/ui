import { S3_DEFAULT_KEY_PREFIX } from "@/domains/log-sink/lib/log-sink-form";
import type { LogSinkSpec } from "@/domains/log-sink/types";

const countFormatter = new Intl.NumberFormat("en-US");

/** The API omits zero counters, so absent reads as 0 (data.md, list). */
export const formatEventCount = (value: number | null | undefined): string =>
  countFormatter.format(value ?? 0);

/**
 * The list's Destination cell (data.md, "UI facts added for s3"):
 * victorialogs → its URL; s3 → s3://<bucket>/<prefix or default>, plus the
 * endpoint's host when one is set.
 */
export function formatLogSinkDestination(
  spec: LogSinkSpec | null | undefined,
): { primary: string; secondary?: string } {
  if (spec?.type === "s3") {
    const s3 = spec.s3;
    const prefix = s3?.key_prefix || S3_DEFAULT_KEY_PREFIX;
    return {
      primary: `s3://${s3?.bucket ?? ""}/${prefix}`,
      secondary: s3?.endpoint ? endpointHost(s3.endpoint) : undefined,
    };
  }
  return { primary: spec?.victorialogs?.url ?? "" };
}

const endpointHost = (endpoint: string): string => {
  try {
    return new URL(endpoint).host || endpoint;
  } catch {
    return endpoint;
  }
};
