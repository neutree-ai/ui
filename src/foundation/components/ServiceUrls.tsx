import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useTranslation } from "@/foundation/lib/i18n";

type ServiceUrlsProps = {
  serviceUrl: string;
};

function CopyableUrl({ label, url }: { label: string; url: string }) {
  const { t } = useTranslation();
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_32px] items-center gap-x-3 gap-y-1 border-b px-3 py-2 last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)_32px]">
      <span className="text-sm font-medium leading-5 text-muted-foreground sm:whitespace-nowrap">
        {label}
      </span>
      <code className="min-w-0 overflow-x-auto whitespace-nowrap rounded-sm bg-transparent py-1 font-mono text-sm leading-5 text-foreground max-sm:col-start-1">
        {url}
      </code>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        title={t("api_keys.buttons.copy")}
        aria-label={`${label} ${t("api_keys.buttons.copy")}`}
        onClick={() =>
          copy(url, {
            successMessage: t("components.apiKey.copySuccess"),
            errorMessage: t("components.apiKey.errors.copyFailed"),
          })
        }
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

export default function ServiceUrls({ serviceUrl }: ServiceUrlsProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-md border bg-[var(--nt-fill-neutral-opaque-1)] dark:bg-[var(--nt-fill-neutral-opaque-2)]">
      <CopyableUrl
        label={t("common.fields.openaiUrl")}
        url={`${serviceUrl}/v1`}
      />
      <CopyableUrl
        label={t("common.fields.anthropicUrl")}
        url={`${serviceUrl}/anthropic`}
      />
    </div>
  );
}
