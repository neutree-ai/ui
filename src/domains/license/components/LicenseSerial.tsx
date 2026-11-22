import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useTranslation } from "@/foundation/lib/i18n";

export function LicenseSerial({ serial }: { serial: string }) {
  const { t } = useTranslation();
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 break-all font-mono">{serial}</div>
      <Button
        variant="outline"
        size="icon"
        className="shrink-0"
        onClick={() =>
          copy(serial, {
            successMessage: t("license.success.serialCopied"),
            errorMessage: t("license.errors.updateFailed"),
          })
        }
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
