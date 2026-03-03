import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useTranslation } from "@/foundation/lib/i18n";
import { Check, Copy } from "lucide-react";

type ServiceUrlsProps = {
  serviceUrl: string;
};

function CopyableUrl({ label, url }: { label: string; url: string }) {
  const { t } = useTranslation();
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <code className="text-sm break-all">{url}</code>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
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
    <div className="flex flex-col gap-1">
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
