import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import EngineStatus from "@/domains/engine/components/EngineStatus";
import { EngineVersionSummary } from "@/domains/engine/components/EngineVersionSummary";
import { isExceptionalEnginePhase } from "@/domains/engine/lib/engine-phase";
import { newestEngineVersion } from "@/domains/engine/lib/version-order";
import type { Engine } from "@/domains/engine/types";
import { Link } from "@/foundation/components/Link";
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
  const name = engine.metadata.name;
  const workspace = engine.metadata.workspace ?? "";
  const versions = engine.spec.versions ?? [];
  const newest = newestEngineVersion(versions);
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

        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-3">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--nt-text-neutral-quaternary)]">
            {t("engines.versions.latest")}
          </span>
          {/* Debug and backport builds ship long version tags, so let the chip
					    shrink and ellipsize rather than pushing the count off the card. */}
          <Badge
            data-testid="engine-latest-version"
            variant="outline"
            className="max-w-full overflow-hidden font-mono"
          >
            <span className="truncate" title={newest?.version ?? "-"}>
              {newest?.version ?? "-"}
            </span>
          </Badge>
          {/* Only the hover-card trigger needs to sit above the card's stretched
					    link; the rest of the row stays clickable as part of the card. */}
          <div className="relative z-20 ml-auto">
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
