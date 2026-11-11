import { formatBytes } from "@/foundation/lib/unit";

// Display formats for endpoint performance metrics. A missing, non-finite or
// negative value is not a measurement and renders as a dash.
const isMeasurement = (value?: number | null): value is number =>
  value != null && Number.isFinite(value) && value >= 0;

export function formatLatency(seconds?: number | null): string {
  if (!isMeasurement(seconds)) return "—";
  if (seconds === 0) return "0 ms";
  if (seconds < 1) {
    const ms = seconds * 1000;
    return `${ms < 10 ? ms.toFixed(1) : ms.toFixed(0)} ms`;
  }
  return `${seconds.toFixed(2)} s`;
}

export function formatLatencyAxis(seconds: number): string {
  if (seconds < 1) return (seconds * 1000).toFixed(0);
  return seconds.toFixed(2);
}

export function formatTokenRate(tokensPerSec?: number | null): string {
  if (!isMeasurement(tokensPerSec)) return "—";
  return `${tokensPerSec >= 100 ? tokensPerSec.toFixed(1) : tokensPerSec.toFixed(2).replace(/\.?0+$/, "")} tok/s`;
}

export function formatPercent(ratio?: number | null): string {
  if (!isMeasurement(ratio)) return "—";
  return `${(Math.min(1, ratio) * 100).toFixed(1)}%`;
}

// Rates of a GiB per second and above keep two decimals.
export function formatBandwidth(bytesPerSec?: number | null): string {
  if (!isMeasurement(bytesPerSec)) return "—";
  return `${formatBytes(bytesPerSec, bytesPerSec >= 1024 ** 3 ? 2 : 1)}/s`;
}
