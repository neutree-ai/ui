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
    <div className={cn("min-w-0 text-left", className)}>
      <div className="truncate text-sm">{label || "-"}</div>
      {description ? (
        <div className="truncate text-[10px] font-normal text-muted-foreground/70">
          {description}
        </div>
      ) : null}
    </div>
  );
}
