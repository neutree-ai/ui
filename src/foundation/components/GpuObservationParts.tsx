import { CircleAlert, CircleCheck, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import type { ObservedGpu } from "@/foundation/lib/accelerator-observations";
import { useTranslation } from "@/foundation/lib/i18n";
import { formatMiBAsGiB, formatMiBAsGiBValue } from "@/foundation/lib/unit";
import { cn } from "@/foundation/lib/utils";

export const GPU_BAR_TRACK_CLASS =
  "relative rounded-full border border-[var(--nt-stroke-neutral-trans-3)] bg-[var(--nt-fill-neutral-opaque-2)]";
/** The thin vertical tick that marks measured usage on a reservation bar. */
export const ACTUAL_MARKER_CLASS =
  "rounded-full bg-[var(--nt-text-neutral-super)] [box-shadow:0_0_0_1px_var(--nt-fill-neutral-opaque-1)]";
/** Wash over the mark colour for the "other" part of a reservation. */
export const OTHER_MASK = "hsl(var(--background) / 0.62)";
export const SEGMENT_DIVIDER = "hsl(var(--background) / 0.9)";

/** MiB as "x.y GiB", or the empty-value mark when unknown. */
export const GiB = ({ mib }: { mib: number | null | undefined }) =>
  formatMiBAsGiB(mib) ?? <EmptyValue />;

/** MiB as a bare "x.y" GiB number, for a "used / total GiB" pair. */
export const GiBValue = ({ mib }: { mib: number | null | undefined }) =>
  formatMiBAsGiBValue(mib) ?? <EmptyValue />;

export const formatUtilization = (ratio: number) =>
  `${(ratio * 100).toFixed(0)}%`;

export function DeviceHealth({
  device,
  className,
}: {
  device: ObservedGpu;
  className?: string;
}) {
  const { t } = useTranslation();
  if (device.healthy == null) return <EmptyValue />;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium leading-4",
        device.healthy
          ? "text-[var(--nt-text-colorful-positive)]"
          : "text-[var(--nt-text-colorful-serious)]",
        className,
      )}
    >
      {device.healthy ? (
        <CircleCheck className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <CircleAlert className="h-3.5 w-3.5 shrink-0" />
      )}
      {t(
        device.healthy
          ? "clusters.options.healthy"
          : "clusters.options.unhealthy",
      )}
    </span>
  );
}

export function CopyUuidButton({ device }: { device: ObservedGpu }) {
  const { t } = useTranslation();
  const { copy } = useCopyToClipboard();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={t("clusters.actions.copyUuid")}
          aria-label={`${t("clusters.fields.gpuNumber")} ${device.index} ${t("clusters.actions.copyUuid")}`}
          className="h-7 w-7 text-muted-foreground"
          onClick={(event) => {
            event.stopPropagation();
            copy(device.uuid, {
              successMessage: t("clusters.messages.copyUuidSuccess"),
              errorMessage: t("clusters.messages.copyUuidFailed"),
            });
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("clusters.actions.copyUuid")}</TooltipContent>
    </Tooltip>
  );
}
