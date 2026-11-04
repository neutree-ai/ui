import type { LogSinkSpec } from "@/domains/log-sink/types";

/** `spec.enabled` is stored as true when omitted; only an explicit false is off. */
export const isLogSinkEnabled = (spec: LogSinkSpec | undefined): boolean =>
  spec?.enabled !== false;

const countFormatter = new Intl.NumberFormat("en-US");

/** The API omits zero counters, so absent reads as 0. */
export const formatEventCount = (value: number | null | undefined): string =>
  countFormatter.format(value ?? 0);
