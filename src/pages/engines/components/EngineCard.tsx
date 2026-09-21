import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import EngineStatus from "@/domains/engine/components/EngineStatus";
import { EngineVersionSummary } from "@/domains/engine/components/EngineVersionSummary";
import { isExceptionalEnginePhase } from "@/domains/engine/lib/engine-phase";
import { newestEngineVersion } from "@/domains/engine/lib/version-order";
import type { Engine } from "@/domains/engine/types";
import { Link } from "@/foundation/components/Link";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { useTranslation } from "@/foundation/lib/i18n";

type EngineCardProps = {
  engine: Engine;
  onSelectVersion: (version: string) => void;
};

/**
 * Engine list card. The card is the click target for the detail page, so it
 * carries a stretched link instead of a "View details" action; the version
 * summary sits above it in the stacking order so its hover card stays usable.
 */
export function EngineCard({ engine, onSelectVersion }: EngineCardProps) {
  const { t } = useTranslation();
  const versionRef = useRef<HTMLSpanElement>(null);
  const versionIsTruncated = useIsTruncated(versionRef);
  const name = engine.metadata.name;
  const workspace = engine.metadata.workspace ?? "";
  const versions = engine.spec.versions ?? [];
  const newest = newestEngineVersion(versions);
  const newestLabel = newest?.version ?? "-";
  const tasks = engine.spec.supported_tasks ?? [];
  const showsStatus = isExceptionalEnginePhase(engine.status?.phase);

  return (
    <Card
      data-testid="engine-card"
      data-name={name}
      className="group relative flex h-full flex-col transition-colors hover:border-primary/40"
    >
      <Link
        href={`/${workspace}/engines/show/${name}`}
        aria-label={t("engines.card.open", { name })}
        className="absolute inset-0 z-10 rounded-[var(--nt-radius-card)] focus-visible:[outline:2px_solid_var(--nt-stroke-outstanding-base)] focus-visible:[outline-offset:2px]"
      />
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--nt-text-neutral-super)]">
            {name}
          </h3>
          {showsStatus && (
            <div className="shrink-0 whitespace-nowrap">
              <EngineStatus {...engine.status} />
            </div>
          )}
        </div>

        {tasks.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {tasks.map((task) => (
              <Badge key={task} variant="outline">
                {task}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 border-t pt-3">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--nt-text-neutral-quaternary)]">
            {t("engines.versions.latest")}
          </span>
          {/* Debug and backport builds ship long version tags. The chip gives up
						 width instead of wrapping the row. It is its own link to the same
						 detail page so it can sit above the card's stretched link: a
						 truncated value has to stay reachable by hover AND keyboard focus,
						 which a non-interactive chip under the overlay cannot do. */}
          <div className="min-w-0 flex-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`/${workspace}/engines/show/${name}`}
                  className="relative z-20 block max-w-full rounded-[var(--nt-radius-input)] focus-visible:[outline:2px_solid_var(--nt-stroke-outstanding-base)] focus-visible:[outline-offset:2px]"
                >
                  <Badge
                    data-testid="engine-latest-version"
                    variant="outline"
                    className="max-w-full overflow-hidden font-mono"
                  >
                    <span ref={versionRef} className="truncate">
                      {newestLabel}
                    </span>
                  </Badge>
                </Link>
              </TooltipTrigger>
              {versionIsTruncated && (
                <TooltipContent className="max-w-[420px] break-all font-mono">
                  {newestLabel}
                </TooltipContent>
              )}
            </Tooltip>
          </div>
          {/* Only the hover-card trigger needs to sit above the card's stretched
					    link; the rest of the row stays clickable as part of the card. */}
          <div className="relative z-20 shrink-0">
            <EngineVersionSummary
              versions={versions}
              onSelectVersion={onSelectVersion}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
