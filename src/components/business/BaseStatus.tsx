import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BaseStatus as BaseStatusType } from "@/types";
import { useTranslation } from "react-i18next";
import Timestamp from "./Timestamp";

type BaseStatusProps = BaseStatusType & {
  className?: string;
  translatedPhase: string;
};

export default function BaseStatus({
  phase,
  error_message,
  className,
  translatedPhase,
  last_transition_time,
}: BaseStatusProps) {
  const { t } = useTranslation();

  if (!phase) {
    return "-";
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <span
          className={cn(
            "px-2 py-1 text-xs font-semibold rounded-lg",
            className,
          )}
        >
          {translatedPhase}
        </span>
      </TooltipTrigger>
      <TooltipContent className={cn(className, "max-w-lg")}>
        <div className="gap-2 flex flex-col">
          {error_message && <div>{error_message}</div>}
          {last_transition_time && (
            <div>
              {t("status.last_transition")}
              <Timestamp timestamp={last_transition_time} />
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
