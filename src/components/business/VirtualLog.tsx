import { cn } from "@/lib/utils";
import { createLowlight } from "lowlight";
import { useTheme } from "next-themes";
import { type FC, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FixedSizeList as List, type ListOnScrollProps } from "react-window";
import "./log-viewer.css";

// Initialize lowlight
const lowlight = createLowlight();

// Register prolog language for log files (same as Ray)
import prolog from "highlight.js/lib/languages/prolog";
lowlight.register("prolog", prolog);

// Types for highlight.js AST nodes (simplified)
type HastNode = {
  type: string;
  tagName?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
  value?: string;
};

// Unique key generator for React elements
const uniqueKeySelector = () => Math.random().toString(16).slice(-8);

// Helper function to filter logs by timestamp
const filterByTimestamp = (
  line: string,
  startTime?: string,
  endTime?: string,
): boolean => {
  const timestampMatch = line.match(/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/);
  if (!timestampMatch) {
    return true; // Include lines without recognizable timestamps
  }

  const ts = Date.parse(timestampMatch[0]);
  if (Number.isNaN(ts)) return true;

  if (startTime && ts < Date.parse(startTime)) return false;
  if (endTime && ts > Date.parse(endTime)) return false;

  return true;
};

// Convert lowlight AST to React elements with search highlighting
const value2react = (
  node: HastNode,
  key: string,
  keywords = "",
): React.ReactNode => {
  switch (node.type) {
    case "element":
      return (
        <span
          key={`${key}line${uniqueKeySelector()}`}
          className={cn(node.properties?.className?.[0] || "")}
        >
          {node.children?.map((child, i) =>
            value2react(child, `${key}-${i}`, keywords),
          )}
        </span>
      );
    case "text": {
      const value = node.value || "";
      if (keywords) {
        // Case-insensitive search
        const lowerValue = value.toLowerCase();
        const lowerKeywords = keywords.toLowerCase();

        if (lowerValue.includes(lowerKeywords)) {
          const regex = new RegExp(
            `(${keywords.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
            "gi",
          );
          const parts = value.split(regex);
          const result: React.ReactNode[] = [];

          for (let i = 0; i < parts.length; i++) {
            if (parts[i]) {
              if (parts[i].toLowerCase() === lowerKeywords) {
                result.push(
                  <mark
                    key={`highlight-${key}-${i}`}
                    className="bg-yellow-200 dark:bg-yellow-800/80 text-yellow-900 dark:text-yellow-100 rounded-sm font-medium"
                  >
                    {parts[i]}
                  </mark>,
                );
              } else {
                result.push(parts[i]);
              }
            }
          }
          return result;
        }
      }
      return value;
    }
    default:
      return null;
  }
};

export interface VirtualLogProps {
  log: string;
  search?: string;
  reverse?: boolean;
  startTime?: string;
  endTime?: string;
  fontSize?: number;
  onScrollBottom?: () => void;
}

/**
 * VirtualLog Component (Pure rendering layer)
 *
 * A virtualized log viewer component that efficiently renders large amounts of log data.
 * Supports search highlighting, time filtering, and reverse ordering.
 */
export const VirtualLog: FC<VirtualLogProps> = ({
  log,
  search = "",
  reverse = false,
  startTime,
  endTime,
  fontSize = 12,
  onScrollBottom,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const listRef = useRef<List>(null);

  /**
   * Process log lines:
   * 1. Split lines
   * 2. Filter by time window (if provided)
   * 3. Apply order (reverse?)
   */
  const processedLines = useMemo(() => {
    if (!log) return [];

    const rawLines = log.split("\n").filter((line) => line.trim());

    // Time filter using the abstracted helper function
    const filtered = rawLines.filter((line) =>
      filterByTimestamp(line, startTime, endTime),
    );

    if (reverse) filtered.reverse();

    return filtered;
  }, [log, reverse, startTime, endTime]);

  /**
   * Render a single log line with syntax highlighting and search highlighting
   */
  const renderLine = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const line = processedLines[index] ?? "";
      const lineNumber = index + 1;

      // Detect log level and apply appropriate styling
      const logLevel = useMemo(() => {
        const upperLine = line.toUpperCase();
        if (upperLine.includes("ERROR") || upperLine.includes("FATAL"))
          return "error";
        if (upperLine.includes("WARN")) return "warning";
        if (upperLine.includes("INFO")) return "info";
        if (upperLine.includes("DEBUG") || upperLine.includes("TRACE"))
          return "debug";
        return "default";
      }, [line]);

      // Try to detect log format for better highlighting
      const logLanguage = useMemo(() => {
        // Use prolog for log highlighting (same as Ray dashboard)
        return "prolog";
      }, []);

      // Apply syntax highlighting
      const highlightResult = useMemo(() => {
        try {
          return lowlight.highlight(logLanguage, line);
        } catch (error) {
          // Fallback to plaintext if highlighting fails
          return {
            type: "root" as const,
            children: [{ type: "text" as const, value: line }],
          };
        }
      }, [line, logLanguage]);

      // Convert to React elements with search highlighting
      const content = useMemo(() => {
        const result = highlightResult as { children?: HastNode[] };
        return (
          result.children?.map((child, i) =>
            value2react(child, `${index}-${i}`, search?.trim() || ""),
          ) || []
        );
      }, [highlightResult, index, search]);

      // Get log level styling based on our theme system
      const levelStyles = useMemo(() => {
        switch (logLevel) {
          case "error":
            return "border-l-destructive";
          case "warning":
            return "border-l-yellow-500";
          case "info":
            return "border-l-primary";
          case "debug":
            return "border-l-muted-foreground";
          default:
            return "border-l-transparent";
        }
      }, [logLevel]);

      return (
        <div
          style={{
            ...style,
            fontSize: `${fontSize}px`,
            lineHeight: `${fontSize + 6}px`,
            minWidth: "max-content",
          }}
          className={cn(
            "group flex items-start gap-3 px-2 py-0 font-mono text-sm",
            "border-l-2 border-r border-r-transparent",
            "relative virtual-log-line",
            "whitespace-nowrap overflow-visible",
            levelStyles,
          )}
        >
          {/* Line number with Ray-style background */}
          <span className="relative z-10 text-muted-foreground text-xs select-none min-w-[3ch] text-right shrink-0 font-medium">
            {lineNumber}
          </span>

          {/* Log content with syntax highlighting */}
          <span className="relative z-10 whitespace-nowrap">{content}</span>
        </div>
      );
    },
    [processedLines, search, fontSize],
  );

  /** Calculate dimensions */
  const lineHeight = fontSize + 6; // padding included
  const listHeight =
    typeof window === "undefined" ? 600 : window.innerHeight * 0.6;

  /**
   * Handle scroll to detect when user reaches bottom/top for infinite loading
   */
  const handleScroll = (props: ListOnScrollProps) => {
    if (!onScrollBottom) return;

    const { scrollDirection, scrollOffset, scrollUpdateWasRequested } = props;
    if (scrollUpdateWasRequested) return; // Skip programmatic scrolls

    if (!reverse) {
      // Normal order: detect bottom
      const atBottom =
        scrollOffset + listHeight >= processedLines.length * lineHeight - 10;
      if (atBottom && scrollDirection === "forward") {
        onScrollBottom();
      }
    } else {
      // Reversed order: detect top
      if (scrollOffset <= 10 && scrollDirection === "backward") {
        onScrollBottom();
      }
    }
  };

  /**
   * Auto-scroll to latest logs when in normal mode
   */
  useEffect(() => {
    if (!listRef.current || !processedLines.length) return;

    if (!reverse) {
      // Scroll to bottom for latest logs
      listRef.current.scrollToItem(processedLines.length - 1, "end");
    }
  }, [processedLines.length, reverse]);

  // Determine theme class for highlight.js
  const hlThemeClass = useMemo(() => {
    const resolvedTheme = theme === "system" ? "light" : theme; // Default to light for system
    return resolvedTheme === "dark" ? "hljs-dark" : "hljs-light";
  }, [theme]);

  if (!processedLines.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">
          {t("components.logViewer.noLogs")}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 virtual-log-container", hlThemeClass)}>
      {/* @ts-ignore - react-window type compatibility issue */}
      <List
        ref={listRef}
        height={listHeight}
        itemCount={processedLines.length}
        itemSize={lineHeight}
        width="100%"
        onScroll={handleScroll}
        className={cn("font-mono virtual-log-list", hlThemeClass)}
      >
        {renderLine}
      </List>
    </div>
  );
};
