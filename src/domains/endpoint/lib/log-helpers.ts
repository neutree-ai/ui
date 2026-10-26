import type { LogSource } from "@/domains/endpoint/hooks/use-endpoint-log-sources";

export function getDefaultLogContainer(
  containers: LogSource[],
  engineNames: ReadonlySet<string>,
): LogSource | undefined {
  return (
    containers.find(
      (container) =>
        engineNames.has(container.container_name ?? "") &&
        (container.started || (container.restart_count ?? 0) > 0),
    ) ??
    containers.find(
      (container) => container.container_name === "model-downloader",
    ) ??
    containers[0]
  );
}

function withLogParams(
  url: string,
  params: Record<string, string | undefined>,
): string {
  const [baseUrl, ...fragmentParts] = url.split("#");
  const [pathname, ...queryParts] = baseUrl.split("?");
  const searchParams = new URLSearchParams(queryParts.join("?"));

  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) searchParams.delete(name);
    else searchParams.set(name, value);
  }

  return `${pathname}?${searchParams}${fragmentParts.length ? `#${fragmentParts.join("#")}` : ""}`;
}

export function getLogUrls(
  source: { url: string; download_url: string },
  container?: string,
  previous = false,
): { url: string; downloadUrl: string } {
  const params: Record<string, string | undefined> = container
    ? { container, previous: previous ? "true" : undefined }
    : {};

  return {
    url: withLogParams(source.url.replace(/^\/api\/v1(?=\/|$)/, ""), {
      ...params,
      lines: "1000",
    }),
    downloadUrl: container
      ? withLogParams(source.download_url, { ...params, download: "true" })
      : source.download_url,
  };
}

/**
 * Filter a log line by timestamp range.
 *
 * Returns `true` (include) when the line has no recognisable timestamp,
 * the timestamp cannot be parsed, or it falls within [startTime, endTime].
 */
export function filterByTimestamp(
  line: string,
  startTime?: string,
  endTime?: string,
): boolean {
  const timestampMatch = line.match(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/);
  if (!timestampMatch) {
    return true; // Include lines without recognizable timestamps
  }

  const ts = Date.parse(timestampMatch[0]);
  if (Number.isNaN(ts)) return true;

  if (startTime && ts < Date.parse(startTime)) return false;
  if (endTime && ts > Date.parse(endTime)) return false;

  return true;
}
