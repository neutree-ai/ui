import { CircleHelp } from "lucide-react";
import { FormLabel } from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/foundation/lib/i18n";

export default function UpstreamNameLabel() {
  const { t } = useTranslation();
  return (
    <div className="inline-flex items-center gap-1">
      <FormLabel className="text-sm font-normal leading-[22px] text-muted-foreground">
        {t("external_endpoints.fields.upstreamName")}
      </FormLabel>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("external_endpoints.messages.upstreamNameHint")}
            >
              <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs leading-relaxed">
            {t("external_endpoints.messages.upstreamNameHint")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
