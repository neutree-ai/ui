import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import type { Metadata } from "@/foundation/types/basic-types";
import { KeyValueTags } from "./MetadataCard";

type MetadataDisclosureProps = {
  metadata: Metadata;
  className?: string;
};

export function MetadataDisclosure({
  metadata,
  className,
}: MetadataDisclosureProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const labelCount = Object.keys(metadata.labels ?? {}).length;
  const annotationCount = Object.keys(metadata.annotations ?? {}).length;
  const hasLabels = labelCount > 0;
  const hasAnnotations = annotationCount > 0;

  if (!hasLabels && !hasAnnotations) {
    return null;
  }

  const summary = [
    hasLabels
      ? `${labelCount} ${t("common.fields.labels").toLowerCase()}`
      : null,
    hasAnnotations
      ? `${annotationCount} ${t("common.fields.annotations").toLowerCase()}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn("border-t pt-3", className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm py-1 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {open ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          )}
          <span className="font-medium">{t("common.fields.metadata")}</span>
          <span className="text-xs">{summary}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-3">
        {hasLabels && (
          <ShowPage.Row title={t("common.fields.labels")}>
            <KeyValueTags data={metadata.labels} />
          </ShowPage.Row>
        )}
        {hasAnnotations && (
          <ShowPage.Row title={t("common.fields.annotations")}>
            <KeyValueTags data={metadata.annotations} />
          </ShowPage.Row>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
