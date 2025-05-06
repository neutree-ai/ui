import type React from "react";
import { useEffect, useState } from "react";
import dayjs from "dayjs";

interface TimestampProps {
  timestamp: number | string; // Unix timestamp (seconds or milliseconds) or ISO string
  format?: string; // Optional custom format
  className?: string; // Optional CSS class
}

/**
 * Timestamp component to display formatted date and time
 */
const Timestamp: React.FC<TimestampProps> = ({
  timestamp,
  format = "YYYY-MM-DD HH:mm", // Default format: year-month-day hour:minute
  className,
}) => {
  const [formattedTime, setFormattedTime] = useState<string>("");

  useEffect(() => {
    try {
      // Handle different timestamp formats
      const date =
        typeof timestamp === "number"
          ? timestamp < 10000000000
            ? dayjs.unix(timestamp)
            : dayjs(timestamp) // Handle seconds vs milliseconds
          : dayjs(timestamp);

      if (date.isValid()) {
        setFormattedTime(date.format(format));
      } else {
        setFormattedTime("Invalid date");
      }
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      setFormattedTime("Invalid date");
    }
  }, [timestamp, format]);

  if (!formattedTime) {
    return <span className={className}>-</span>;
  }

  return <span className={className}>{formattedTime}</span>;
};

export default Timestamp;
