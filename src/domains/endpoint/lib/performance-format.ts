// Display formats for endpoint performance metrics. A missing, non-finite or
// negative value is not a measurement and renders as a dash.
export function formatLatency(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds === 0) return "0 ms";
  if (seconds < 1) {
    const ms = seconds * 1000;
    return `${ms < 10 ? ms.toFixed(1) : ms.toFixed(0)} ms`;
  }
  return `${seconds.toFixed(2)} s`;
}

export function formatTokenRate(tokensPerSec?: number | null): string {
  if (
    tokensPerSec == null ||
    !Number.isFinite(tokensPerSec) ||
    tokensPerSec < 0
  ) {
    return "—";
  }
  if (tokensPerSec === 0) return "0 tok/s";
  return `${tokensPerSec >= 100 ? tokensPerSec.toFixed(1) : tokensPerSec.toFixed(2).replace(/\.?0+$/, "")} tok/s`;
}

export function formatPercent(ratio?: number | null): string {
  if (ratio == null || !Number.isFinite(ratio) || ratio < 0) return "—";
  const clamped = Math.max(0, Math.min(1, ratio));
  return `${(clamped * 100).toFixed(1)}%`;
}

export function formatBandwidth(bytesPerSec?: number | null): string {
  if (bytesPerSec == null || !Number.isFinite(bytesPerSec) || bytesPerSec < 0) {
    return "—";
  }
  if (bytesPerSec === 0) return "0 B/s";
  if (bytesPerSec >= 1024 ** 3) {
    return `${(bytesPerSec / 1024 ** 3).toFixed(2)} GiB/s`;
  }
  if (bytesPerSec >= 1024 ** 2) {
    return `${(bytesPerSec / 1024 ** 2).toFixed(1)} MiB/s`;
  }
  if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KiB/s`;
  }
  return `${bytesPerSec.toFixed(0)} B/s`;
}
