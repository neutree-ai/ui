import dayjs, { type Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type React from "react";
import { useMemo } from "react";

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

interface TimestampProps {
  timestamp: number | string; // Unix timestamp (seconds or milliseconds) or ISO string
  format?: string; // Optional custom format
  className?: string; // Optional CSS class
}

/**
 * Normalize backend timestamp string to ISO format with UTC timezone
 * Backend returns UTC timestamps without timezone identifier, we need to add 'Z' suffix
 */
export const normalizeTimestampString = (timestamp: string): string => {
  let timestampStr = timestamp;

  // Replace space with 'T' if needed (e.g., "2026-01-09 01:21:03" -> "2026-01-09T01:21:03")
  timestampStr = timestampStr.replace(" ", "T");

  // Add 'Z' suffix if no timezone identifier present
  if (!timestampStr.endsWith("Z") && !timestampStr.match(/[+-]\d{2}:\d{2}$/)) {
    timestampStr += "Z";
  }

  return timestampStr;
};

/**
 * Format timestamp to local timezone string
 * @param timestamp - Unix timestamp (seconds or milliseconds) or ISO string
 * @param format - dayjs format string (default: "YYYY-MM-DD HH:mm")
 * @param targetTimezone - Target timezone (default: browser's local timezone)
 * @returns Formatted timestamp string or "Invalid date" on error
 */
export const formatTimestamp = (
  timestamp: number | string,
  format = "YYYY-MM-DD HH:mm",
  targetTimezone?: string,
): string => {
  try {
    let date: Dayjs;

    if (typeof timestamp === "number") {
      // Handle Unix timestamps (seconds or milliseconds)
      date = timestamp < 10000000000 ? dayjs.unix(timestamp) : dayjs(timestamp);
    } else {
      // Handle string timestamps with UTC normalization
      const normalizedTimestamp = normalizeTimestampString(timestamp);
      date = dayjs(normalizedTimestamp);
    }

    // Convert to target timezone (default: browser's local timezone)
    const tz = targetTimezone || dayjs.tz.guess();
    date = date.tz(tz);

    if (date.isValid()) {
      return date.format(format);
    }
    return "Invalid date";
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return "Invalid date";
  }
};

/**
 * Timestamp component to display formatted date and time in browser's local timezone
 */
const Timestamp: React.FC<TimestampProps> = ({
  timestamp,
  format = "YYYY-MM-DD HH:mm", // Default format: year-month-day hour:minute
  className,
}) => {
  const formattedTime = useMemo(() => {
    return formatTimestamp(timestamp, format);
  }, [timestamp, format]);

  if (!formattedTime) {
    return <span className={className}>-</span>;
  }

  return <span className={className}>{formattedTime}</span>;
};

export default Timestamp;
