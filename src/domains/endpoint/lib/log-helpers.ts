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
