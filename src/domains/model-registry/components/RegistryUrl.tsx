import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useTranslation } from "@/foundation/lib/i18n";
import { middleTruncate } from "@/foundation/lib/middle-truncate";
import { cn } from "@/foundation/lib/utils";

/**
 * How much of a registry address the detail header shows before it is
 * shortened.
 *
 * The header keeps its metas on one line inside `max-w-4xl` (896px), and type,
 * visibility and creation time take roughly half of that. At the 13px mono the
 * value renders in, the rest holds about sixty characters — so 44 leaves room
 * for the meta that follows without ever pushing the row over. Every address
 * the server supplies for a shipped registry kind is far below it (a hub URL is
 * ~22 characters, an `nfs://host/mount` ~26), which is the point: only a long
 * private path is shortened at all.
 */
const MAX_LENGTH = 44;

/**
 * The registry's address, as the detail header shows it.
 *
 * A hub address is a link out; a file-system registry names a mount that only
 * a node can resolve, so it is rendered as a machine value rather than as
 * something a browser would try to open.
 *
 * The value is copyable in both cases — the address is what a user pastes into
 * a CLI or a `neutree-cli` manifest, and reading it off the screen is not a
 * workflow. When it is shortened, the full value stays available on hover and
 * on keyboard focus through the tooltip the app already provides.
 */
export const RegistryUrl = ({ url }: { url: string }) => {
  const { t } = useTranslation();
  const { copy, copied } = useCopyToClipboard();
  const { text, truncated } = middleTruncate(url, MAX_LENGTH);
  const isLink = /^https?:\/\//i.test(url);

  const valueClassName = cn(
    "rounded-sm font-mono text-[13px] leading-6",
    "focus-visible:outline-none focus-visible:shadow-[var(--nt-outline-active-focus)]",
    isLink
      ? "text-[var(--nt-text-colorful-outstanding)]"
      : "text-[var(--nt-text-neutral-secondary)]",
  );

  const value = isLink ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={valueClassName}
      tabIndex={truncated ? 0 : undefined}
    >
      {text}
    </a>
  ) : (
    // Not a link, but focusable when shortened: the tooltip is the only way to
    // read the full value, and it must not be reachable by mouse alone.
    <span className={valueClassName} tabIndex={truncated ? 0 : undefined}>
      {text}
    </span>
  );

  return (
    <span className="inline-flex min-w-0 items-center gap-1 rounded-sm px-0.5 hover:bg-[var(--nt-fill-neutral-opaque-1)]">
      {truncated ? (
        <Tooltip>
          <TooltipTrigger asChild>{value}</TooltipTrigger>
          <TooltipContent className="max-w-[440px]">
            <span className="font-mono text-xs [overflow-wrap:anywhere]">
              {url}
            </span>
          </TooltipContent>
        </Tooltip>
      ) : (
        value
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-[var(--nt-text-neutral-secondary)]"
        title={t("model_registries.actions.copyUrl")}
        aria-label={t("model_registries.actions.copyUrl")}
        onClick={() =>
          copy(url, {
            successMessage: t("model_registries.messages.copyUrlSuccess"),
            errorMessage: t("model_registries.messages.copyUrlFailed"),
          })
        }
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </span>
  );
};
