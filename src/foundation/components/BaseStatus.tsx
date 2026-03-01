import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { cn } from "@/foundation/lib/utils";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";
import { Check, Copy } from "lucide-react";
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
  const { copy, copied } = useCopyToClipboard();

  const copyErrorMessage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!error_message) return;
    await copy(error_message, {
      successMessage: t("status.copyErrorSuccess"),
      errorMessage: t("status.copyErrorFailed"),
    });
  };

  if (!phase) {
    return "-";
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <span className="inline-flex items-center gap-1">
          <span
            className={cn(
              "px-2 py-1 text-xs font-semibold rounded-lg",
              className,
            )}
          >
            {translatedPhase}
          </span>
          {error_message && (
            <div
              onClick={copyErrorMessage}
              className="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent className={cn(className, "max-w-lg")}>
        <div className="gap-2 flex flex-col">
          {error_message && (
            <pre className="overflow-auto max-h-96 max-w-lg whitespace-pre-wrap break-words">
              {error_message}
            </pre>
          )}
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
