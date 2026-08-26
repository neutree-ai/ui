import { cn } from "@/foundation/lib/utils";

type ResourceUsageLegendItem = {
  label: string;
  markerClassName: string;
};

export function ResourceUsageLegend({
  items,
  className,
}: {
  items: ResourceUsageLegendItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs font-normal text-muted-foreground",
        className,
      )}
    >
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <i className={cn("shrink-0", item.markerClassName)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
