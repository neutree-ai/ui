import {
  type LogSinkFormValues,
  toLogSinkSpec,
} from "@/domains/log-sink/lib/log-sink-form";
import type {
  LogSinkConnectionTest,
  LogSinkSpec,
} from "@/domains/log-sink/types";
import { getErrorMessage } from "@/foundation/lib/error-message";

export type TestConnectionResult = LogSinkConnectionTest;

type TestConnectionRequest =
  | { spec: LogSinkSpec }
  | { id: number }
  | { id: number; spec: LogSinkSpec };

export type TestConnectionTarget =
  | { mode: "create"; values: LogSinkFormValues }
  | { mode: "edit"; id: number; values: LogSinkFormValues }
  | { mode: "stored"; id: number };

/** Forms send the spec the submit would save, built by the same builder. */
export function buildTestConnectionRequest(
  target: TestConnectionTarget,
): TestConnectionRequest {
  switch (target.mode) {
    case "create":
      return { spec: toLogSinkSpec(target.values) };
    case "edit":
      return { id: target.id, spec: toLogSinkSpec(target.values) };
    case "stored":
      return { id: target.id };
  }
}

/**
 * HTTP errors arrive as `{"error": "..."}`; the data provider's custom call
 * rejects with "Error: <status> <text> <url> <body>". Read the body's error.
 */
export function readTestConnectionError(
  error: unknown,
  fallback: string,
): string {
  const message = getErrorMessage(error, "");
  if (!message) return fallback;
  const body = message.match(/(\{.*\})\s*$/s)?.[1];
  if (body) {
    try {
      const parsed = JSON.parse(body) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error) {
        return parsed.error;
      }
    } catch {
      // Not JSON: fall through to the raw message.
    }
  }
  return message;
}
