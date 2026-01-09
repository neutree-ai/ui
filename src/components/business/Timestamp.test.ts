import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { describe, expect, it } from "vitest";
import { formatTimestamp, normalizeTimestampString } from "./Timestamp";

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

describe("normalizeTimestampString", () => {
  it("should replace space with T", () => {
    expect(normalizeTimestampString("2026-01-09 01:21:03")).toBe(
      "2026-01-09T01:21:03Z",
    );
  });

  it("should add Z suffix when no timezone identifier present", () => {
    expect(normalizeTimestampString("2026-01-09T01:21:03.988081")).toBe(
      "2026-01-09T01:21:03.988081Z",
    );
  });

  it("should not add Z suffix if already present", () => {
    expect(normalizeTimestampString("2026-01-09T01:21:03Z")).toBe(
      "2026-01-09T01:21:03Z",
    );
  });

  it("should not add Z suffix if timezone offset present", () => {
    expect(normalizeTimestampString("2026-01-09T01:21:03+08:00")).toBe(
      "2026-01-09T01:21:03+08:00",
    );
  });

  it("should not add Z suffix if negative timezone offset present", () => {
    expect(normalizeTimestampString("2026-01-09T01:21:03-05:00")).toBe(
      "2026-01-09T01:21:03-05:00",
    );
  });

  it("should handle timestamp with microseconds", () => {
    expect(normalizeTimestampString("2026-01-09T01:21:03.988081")).toBe(
      "2026-01-09T01:21:03.988081Z",
    );
  });

  it("should handle timestamp with space and microseconds", () => {
    expect(normalizeTimestampString("2026-01-09 01:21:03.988081")).toBe(
      "2026-01-09T01:21:03.988081Z",
    );
  });
});

describe("formatTimestamp", () => {
  describe("with number timestamps", () => {
    it("should format Unix timestamp in seconds", () => {
      // Use dayjs to calculate the expected timestamp
      const timestamp = dayjs.utc("2026-01-09 00:00:00").unix();
      const result = formatTimestamp(timestamp, "YYYY-MM-DD HH:mm", "UTC");
      expect(result).toBe("2026-01-09 00:00");
    });

    it("should format Unix timestamp in milliseconds", () => {
      // Use dayjs to calculate the expected timestamp
      const timestamp = dayjs.utc("2026-01-09 00:00:00").valueOf();
      const result = formatTimestamp(timestamp, "YYYY-MM-DD HH:mm", "UTC");
      expect(result).toBe("2026-01-09 00:00");
    });

    it("should handle small timestamp as seconds", () => {
      // Timestamps < 10000000000 are treated as seconds
      const result = formatTimestamp(1000000000, "YYYY-MM-DD", "UTC");
      expect(result).toBe("2001-09-09");
    });

    it("should handle large timestamp as milliseconds", () => {
      // Timestamps >= 10000000000 are treated as milliseconds
      const result = formatTimestamp(10000000000, "YYYY-MM-DD", "UTC");
      expect(result).toBe("1970-04-26");
    });
  });

  describe("with string timestamps", () => {
    it("should format ISO string without timezone identifier", () => {
      const result = formatTimestamp(
        "2026-01-09T01:21:03",
        "YYYY-MM-DD HH:mm",
        "UTC",
      );
      expect(result).toBe("2026-01-09 01:21");
    });

    it("should format backend-style timestamp with space", () => {
      const result = formatTimestamp(
        "2026-01-09 01:21:03",
        "YYYY-MM-DD HH:mm",
        "UTC",
      );
      expect(result).toBe("2026-01-09 01:21");
    });

    it("should format timestamp with microseconds", () => {
      const result = formatTimestamp(
        "2026-01-09T01:21:03.988081",
        "YYYY-MM-DD HH:mm:ss",
        "UTC",
      );
      expect(result).toBe("2026-01-09 01:21:03");
    });

    it("should format timestamp that already has Z suffix", () => {
      const result = formatTimestamp(
        "2026-01-09T01:21:03Z",
        "YYYY-MM-DD HH:mm",
        "UTC",
      );
      expect(result).toBe("2026-01-09 01:21");
    });

    it("should format timestamp with timezone offset", () => {
      const result = formatTimestamp(
        "2026-01-09T01:21:03+08:00",
        "YYYY-MM-DD HH:mm",
        "UTC",
      );
      // +08:00 to UTC means subtracting 8 hours
      expect(result).toBe("2026-01-08 17:21");
    });
  });

  describe("with custom format", () => {
    it("should format with full date-time format", () => {
      const result = formatTimestamp(
        "2026-01-09T01:21:03",
        "YYYY-MM-DD HH:mm:ss",
        "UTC",
      );
      expect(result).toBe("2026-01-09 01:21:03");
    });

    it("should format with date only", () => {
      const result = formatTimestamp("2026-01-09T01:21:03", "YYYY-MM-DD", "UTC");
      expect(result).toBe("2026-01-09");
    });

    it("should format with time only", () => {
      const result = formatTimestamp("2026-01-09T01:21:03", "HH:mm:ss", "UTC");
      expect(result).toBe("01:21:03");
    });

    it("should use default format when not specified", () => {
      const result = formatTimestamp("2026-01-09T01:21:03", undefined, "UTC");
      expect(result).toBe("2026-01-09 01:21");
    });
  });

  describe("with timezone conversion", () => {
    it("should convert UTC to Asia/Shanghai", () => {
      const result = formatTimestamp(
        "2026-01-09T00:00:00",
        "YYYY-MM-DD HH:mm",
        "Asia/Shanghai",
      );
      // UTC 00:00 -> Asia/Shanghai 08:00
      expect(result).toBe("2026-01-09 08:00");
    });

    it("should convert UTC to America/New_York", () => {
      const result = formatTimestamp(
        "2026-01-09T00:00:00",
        "YYYY-MM-DD HH:mm",
        "America/New_York",
      );
      // UTC 00:00 -> America/New_York (EST is UTC-5)
      expect(result).toBe("2026-01-08 19:00");
    });

    it("should convert UTC to Europe/London", () => {
      const result = formatTimestamp(
        "2026-01-09T00:00:00",
        "YYYY-MM-DD HH:mm",
        "Europe/London",
      );
      // UTC 00:00 -> Europe/London 00:00 (GMT in January)
      expect(result).toBe("2026-01-09 00:00");
    });
  });

  describe("error handling", () => {
    it("should return 'Invalid date' for invalid timestamp string", () => {
      const result = formatTimestamp("invalid-date", "YYYY-MM-DD HH:mm", "UTC");
      expect(result).toBe("Invalid date");
    });

    it("should return 'Invalid date' for empty string", () => {
      const result = formatTimestamp("", "YYYY-MM-DD HH:mm", "UTC");
      expect(result).toBe("Invalid date");
    });

    it("should handle malformed date gracefully", () => {
      const result = formatTimestamp(
        "2026-13-40T25:61:61",
        "YYYY-MM-DD HH:mm",
        "UTC",
      );
      expect(result).toBe("Invalid date");
    });
  });

  describe("real-world backend timestamp formats", () => {
    it("should handle PostgreSQL timestamp without timezone", () => {
      // Backend returns: 2026-01-09 01:21:03.988081
      const result = formatTimestamp(
        "2026-01-09 01:21:03.988081",
        "YYYY-MM-DD HH:mm:ss",
        "UTC",
      );
      expect(result).toBe("2026-01-09 01:21:03");
    });

    it("should handle PostgreSQL timestamp without microseconds", () => {
      // Backend returns: 2026-01-09 01:21:03
      const result = formatTimestamp(
        "2026-01-09 01:21:03",
        "YYYY-MM-DD HH:mm:ss",
        "UTC",
      );
      expect(result).toBe("2026-01-09 01:21:03");
    });

    it("should handle ISO format without timezone", () => {
      // Backend returns: 2026-01-09T01:21:03.988081
      const result = formatTimestamp(
        "2026-01-09T01:21:03.988081",
        "YYYY-MM-DD HH:mm:ss",
        "UTC",
      );
      expect(result).toBe("2026-01-09 01:21:03");
    });

    it("should convert backend UTC timestamp to local timezone", () => {
      // Backend returns UTC: 2026-01-09 00:00:00
      // Should convert to Asia/Shanghai: 2026-01-09 08:00:00
      const result = formatTimestamp(
        "2026-01-09 00:00:00",
        "YYYY-MM-DD HH:mm",
        "Asia/Shanghai",
      );
      expect(result).toBe("2026-01-09 08:00");
    });
  });
});
