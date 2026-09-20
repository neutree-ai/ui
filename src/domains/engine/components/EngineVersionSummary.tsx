import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { EngineVersion } from "@/domains/engine/types";
import { useTranslation } from "@/foundation/lib/i18n";
import { sortEngineVersionsNewestFirst } from "../lib/version-order";

type EngineVersionSummaryProps = {
  versions: EngineVersion[];
  onSelectVersion: (version: string) => void;
};

/**
 * Version entry point for the engine card: a quiet button that opens the full
 * list on hover, mirroring the endpoint Access summary (`openDelay`/`closeDelay`
 * of 120ms, `align="start"`, fixed width).
 *
 * Engines with a single version render nothing: there is no list to scan and a
 * count of one adds no information.
 */
export function EngineVersionSummary({
  versions,
  onSelectVersion,
}: EngineVersionSummaryProps) {
  const { t } = useTranslation();
  const newestFirst = useMemo(
    () => sortEngineVersionsNewestFirst(versions),
    [versions],
  );

  if (newestFirst.length < 2) return null;

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[var(--nt-text-neutral-secondary)] hover:text-[var(--nt-text-neutral-primary)]"
        >
          {t("engines.versions.count", { count: newestFirst.length })}
        </Button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        data-testid="engine-versions-hover-card"
        className="w-[264px] p-2"
      >
        <div className="mb-1 px-2 pt-1 text-xs font-medium text-[var(--nt-text-neutral-tertiary)]">
          {t("engines.versions.all")}
        </div>
        <div className="space-y-1">
          {newestFirst.map((item, index) => (
            <button
              key={item.version}
              type="button"
              onClick={() => onSelectVersion(item.version)}
              className="flex w-full items-center gap-2 rounded-[var(--nt-radius-input)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--nt-fill-neutral-trans-2)]"
            >
              <code className="min-w-0 truncate font-mono text-xs text-[var(--nt-text-neutral-primary)]">
                {item.version}
              </code>
              {index === 0 && (
                <span className="inline-flex shrink-0 items-center rounded-[var(--nt-radius-checkbox)] border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {t("engines.versions.latest")}
                </span>
              )}
            </button>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
