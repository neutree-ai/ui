import { cn } from "@/foundation/lib/utils";

type KeyValueListProps = {
  entries: ReadonlyArray<readonly [string, unknown]>;
  compact?: boolean;
};

export function KeyValueList({ entries, compact = false }: KeyValueListProps) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-4 gap-y-1",
        !compact && "md:grid-cols-2",
      )}
    >
      {entries.map(([key, value]) => (
        <div
          key={key}
          data-key-value-entry={key}
          className="min-w-0 break-all font-mono text-xs"
        >
          <dt className="inline font-medium">{key}</dt>
          <dd className="inline">
            <span className="text-muted-foreground">: </span>
            {formatValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const formatValue = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};
