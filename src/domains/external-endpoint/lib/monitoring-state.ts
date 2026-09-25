const ranges = ["15m", "1h", "6h", "24h", "7d"];
export function readMonitoringState(params: URLSearchParams) {
  const from = params.get("from") ?? "now-1h";
  const to = params.get("to") ?? "now";
  const relative =
    ranges.some((range) => from === `now-${range}`) && to === "now";
  const absolute =
    /^\d+$/.test(from) &&
    /^\d+$/.test(to) &&
    Number(from) < Number(to) &&
    Number(to) <= 8640000000000000;
  const mode = params.get("mode");
  return {
    models: [...new Set(params.getAll("model").filter(Boolean))],
    from: relative || absolute ? from : "now-1h",
    to: relative || absolute ? to : "now",
    mode: mode === "stream" || mode === "non_stream" ? mode : "all",
    refresh: absolute || params.get("refresh") === "off" ? "" : "30s",
    absolute,
  };
}
