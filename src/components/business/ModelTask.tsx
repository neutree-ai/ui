import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";

interface ModelTaskProps {
  task: string | null | undefined;
  variant?: "default" | "outline" | "secondary" | "destructive";
}

// Format task name for better display
export const formatTaskName = (taskName: string) => {
  return taskName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const ModelTask = ({ task, variant = "outline" }: ModelTaskProps) => {
  const { t } = useTranslation();
  if (!task) {
    return <span className="text-muted-foreground">-</span>;
  }

  // Define color variants for different task types
  const getTaskColor = (taskName: string) => {
    const lowerTask = taskName.toLowerCase();

    // Match specific task types
    if (lowerTask === "text-generation") {
      return "bg-blue-100 text-blue-800 border-blue-200";
    }
    if (lowerTask === "text-embedding") {
      return "bg-green-100 text-green-800 border-green-200";
    }
    if (lowerTask === "text-rerank") {
      return "bg-purple-100 text-purple-800 border-purple-200";
    }

    return "bg-gray-100 text-gray-800 border-gray-200";
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
