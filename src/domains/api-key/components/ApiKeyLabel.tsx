import { cn } from "@/foundation/lib/utils";

export function ApiKeyLabel({
  name,
  displayName,
  description,
  className,
}: {
  name?: string | null;
  displayName?: string | null;
  description?: string | null;
  className?: string;
}) {
  const label = displayName || name;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="truncate">{label || "-"}</div>
      {description ? (
        <div className="truncate text-xs text-muted-foreground">
          {description}
        </div>
      ) : null}
    </div>
  );
}
