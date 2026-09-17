import { cn } from "@/foundation/lib/utils";

export function ApiKeyLabel({
  name,
  displayName,
  description,
  variant = "stacked",
  className,
}: {
  name?: string | null;
  displayName?: string | null;
  description?: string | null;
  /**
   * `stacked` is the name with the description under it — a list row or a table
   * cell has the room. `inline` is the name alone on one line, for the places
   * that show it *inside* a fixed-height control: a select trigger is one line
   * tall, and the description there used to overflow the control's own border.
   */
  variant?: "stacked" | "inline";
  className?: string;
}) {
  const label = displayName || name;

  if (variant === "inline") {
    return (
      <span className={cn("block min-w-0 truncate text-sm", className)}>
        {label || "-"}
      </span>
    );
  }

  return (
    <div className={cn("min-w-0 text-left", className)}>
      <div className="truncate text-sm">{label || "-"}</div>
      {description ? (
        // The leading is explicit: at 10px the line otherwise inherits the
        // name's 20px line box, which reads as a gap between the two lines and
        // pushes the block out of any control sized for one line.
        <div className="truncate text-[10px] font-normal leading-4 text-muted-foreground/70">
          {description}
        </div>
      ) : null}
    </div>
  );
}
