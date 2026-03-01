import { Progress } from "@/components/ui/progress";
import { formatToDecimal } from "@/foundation/lib/unit";

interface ResourceProgressBarProps {
  label: string;
  used: number;
  total: number;
  unit?: string;
  compact?: boolean;
  className?: string;
}

export const ResourceProgressBar = ({
  label,
  used,
  total,
  unit,
  compact = false,
  className,
}: ResourceProgressBarProps) => {
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;

  if (compact) {
    return (
      <div className={className}>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatToDecimal(used)} / {formatToDecimal(total)}
              {unit ? ` ${unit}` : ""}
            </span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {formatToDecimal(used)} / {formatToDecimal(total)}
          {unit ? ` ${unit}` : ""} ({percent}%)
        </span>
      </div>
      <Progress value={percent} />
    </div>
  );
};
