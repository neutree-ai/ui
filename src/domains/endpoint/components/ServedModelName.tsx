import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useTranslation } from "@/foundation/lib/i18n";

export function ServedModelName({ name }: { name: string }) {
  const { t } = useTranslation();
  const { copy, copied } = useCopyToClipboard();

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <code className="break-all font-mono text-xs">{name}</code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 text-muted-foreground"
        title={t("api_keys.buttons.copy")}
        aria-label={`${name} ${t("api_keys.buttons.copy")}`}
        onClick={() =>
          copy(name, {
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
    </span>
  );
}
