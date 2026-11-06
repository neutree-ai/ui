import { formatDisplayValue } from "@/domains/endpoint/lib/display-value";

type KeyValueListProps = {
  entries: ReadonlyArray<readonly [string, unknown]>;
};

export function KeyValueList({ entries }: KeyValueListProps) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1">
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
