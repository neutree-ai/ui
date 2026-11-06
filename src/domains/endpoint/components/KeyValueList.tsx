import { formatDisplayValue } from "@/domains/endpoint/lib/display-value";
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
        <div key={key} className="min-w-0 break-all font-mono text-xs">
          <dt className="inline font-medium">{key}</dt>
          <dd className="inline">
            <span className="text-muted-foreground">: </span>
            {formatDisplayValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
