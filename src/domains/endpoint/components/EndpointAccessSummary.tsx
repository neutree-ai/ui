import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

type EndpointAccessSummaryProps = {
  serviceUrl: string;
  className?: string;
};

type AccessUrlRowProps = {
  label: string;
  url: string;
};

function AccessUrlRow({ label, url }: AccessUrlRowProps) {
  const { t } = useTranslation();
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_28px] items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <code className="block min-w-0 truncate font-mono text-xs text-foreground">
          {url}
        </code>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        title={t("api_keys.buttons.copy")}
        aria-label={`${label} ${t("api_keys.buttons.copy")}`}
        onClick={() =>
          copy(url, {
            successMessage: t("components.apiKey.copySuccess"),
            errorMessage: t("components.apiKey.errors.copyFailed"),
          })
        }
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
    </div>
  );
}

export function EndpointAccessSummary({
  serviceUrl,
  className,
}: EndpointAccessSummaryProps) {
  const { t } = useTranslation();
  const urls = [
    {
      label: t("common.fields.openaiUrl"),
      url: `${serviceUrl}/v1`,
    },
    {
      label: t("common.fields.anthropicUrl"),
      url: `${serviceUrl}/anthropic`,
    },
  ];

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-7 gap-1.5 rounded-md px-2 text-xs font-medium",
            className,
          )}
        >
          <Link2 className="size-3.5" />
          {t("endpoints.access.summary", { count: urls.length })}
        </Button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-[420px] p-2">
        <div className="mb-1 px-2 pt-1 text-xs font-medium text-muted-foreground">
          {t("endpoints.access.hoverTitle")}
        </div>
        <div className="space-y-1">
          {urls.map((item) => (
            <AccessUrlRow key={item.url} {...item} />
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
