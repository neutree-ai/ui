import { useTranslation } from "react-i18next";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Link } from "@/foundation/components/Link";
import { endpointHref } from "@/foundation/lib/accelerator-observations";
import { cn } from "@/foundation/lib/utils";
import type { CacheEndpointRef } from "../lib/cache-endpoints";

function CacheEndpointList({
  endpoints,
  className,
}: {
  endpoints: CacheEndpointRef[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {endpoints.map((endpoint) => {
        const chipClassName =
          "max-w-full break-all rounded border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] px-1.5 py-0.5 font-mono text-[11px]";
        return endpoint.name ? (
          <Link
            key={endpoint.key}
            href={endpointHref({
              workspace: endpoint.workspace,
              endpoint: endpoint.name,
            })}
            className={cn(
              chipClassName,
              "text-primary underline-offset-2 hover:border-primary/40 hover:bg-[var(--nt-fill-outstanding-light)] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15",
            )}
          >
            {endpoint.label}
          </Link>
        ) : (
          <span
            key={endpoint.key}
            className={cn(
              chipClassName,
              "text-[var(--nt-text-neutral-secondary)]",
            )}
          >
            {endpoint.label}
          </span>
        );
      })}
    </div>
  );
}

export function CacheEndpointLinks({
  endpoints,
  error,
}: {
  endpoints: CacheEndpointRef[];
  error: boolean;
}) {
  const { t } = useTranslation();

  if (!error && endpoints.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="text-left text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15"
        >
          {error
            ? t("clusters.zcache.dependencyCheckFailed")
            : t("clusters.zcache.dependencyCount", {
                count: endpoints.length,
              })}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-[300px] p-3 text-xs leading-5"
      >
        <div className="font-semibold">
          {error
            ? t("clusters.zcache.dependencyCheckFailedTitle")
            : t("clusters.zcache.dependencyCardTitle", {
                count: endpoints.length,
              })}
        </div>
        {!error && <CacheEndpointList endpoints={endpoints} className="mt-2" />}
        <p className="mt-2 text-muted-foreground">
          {error
            ? t("clusters.zcache.dependencyCheckFailedHint")
            : t("clusters.zcache.dependencyInstruction")}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
