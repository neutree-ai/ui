import { Badge } from "@/components/ui/badge";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { useTranslation } from "@/foundation/lib/i18n";

interface ModelTaskProps {
  task: string | null | undefined;
  variant?: "default" | "outline" | "secondary" | "destructive";
}

export const formatTaskName = (taskName: string) => {
  return taskName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const ModelTask = ({ task, variant = "outline" }: ModelTaskProps) => {
  const { t } = useTranslation();
  if (!task) {
    return <EmptyValue />;
  }

  const getTaskColor = (taskName: string) => {
    const lowerTask = taskName.toLowerCase();

    if (lowerTask === "text-generation") {
      return "border-[var(--nt-stroke-outstanding-light)] bg-[var(--nt-fill-outstanding-thin)] text-[var(--nt-text-colorful-outstanding)]";
    }
    if (lowerTask === "text-embedding") {
      return "border-[var(--nt-stroke-positive-light)] bg-[var(--nt-fill-positive-light)] text-[var(--nt-text-colorful-positive)]";
    }
    if (lowerTask === "text-rerank") {
      return "border-[color:rgba(126,65,255,0.34)] bg-[var(--nt-fill-purple-light)] text-[var(--nt-text-colorful-purple)]";
    }

    return "border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-opaque-1)] text-[var(--nt-text-neutral-secondary)]";
  };

  const customClassName = variant === "outline" ? getTaskColor(task) : "";

  return (
    <Badge
      variant={variant}
      className={`${customClassName} text-xs font-medium`}
    >
      {(() => {
        const translated = t(`models.tasks.${task}`);
        return translated === `models.tasks.${task}`
          ? formatTaskName(task)
          : translated;
      })()}
    </Badge>
  );
};

export default ModelTask;
