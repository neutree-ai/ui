import { useGo, useList, useParsed } from "@refinedev/core";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { Engine } from "@/domains/engine/types";
import { EmptyState } from "@/foundation/components/EmptyState";
import { ListPage } from "@/foundation/components/ListPage";
import { Loader } from "@/foundation/components/Loader";
import { LIST_POLL_QUERY_OPTIONS } from "@/foundation/lib/constant";
import { useTranslation } from "@/foundation/lib/i18n";
import { EngineCard } from "./components/EngineCard";

/** Non-steady phases first, so a broken engine is never buried in the grid. */
const PHASE_PRIORITY: Record<string, number> = {
  Failed: 0,
  Pending: 1,
  Deleted: 2,
  Created: 3,
};

// Engines are a card-first surface: one card per engine, with the versions the
// engine exposes summarized in the card instead of a comma-joined table cell.
// The resource is import-only (no create), so the page keeps a search box and
// nothing else in its toolbar.
export const EnginesList = () => {
  const { t } = useTranslation();
  const go = useGo();
  const { params } = useParsed();
  const workspace = (params?.workspace as string) ?? "";
  const [search, setSearch] = useState("");

  const { data, isLoading } = useList<Engine>({
    resource: "engines",
    pagination: { mode: "off" },
    meta: { workspace },
    // The card grid bypasses the shared Table, so it opts into the same polling
    // the table would have done; otherwise a deleted engine's card lingers.
    queryOptions: {
      enabled: Boolean(workspace),
      ...LIST_POLL_QUERY_OPTIONS,
    },
  });

  const engines = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.data ?? [])
      .filter(
        (engine) =>
          !query || engine.metadata.name.toLowerCase().includes(query),
      )
      .sort((a, b) => {
        const byPhase =
          (PHASE_PRIORITY[a.status?.phase ?? "Created"] ?? 3) -
          (PHASE_PRIORITY[b.status?.phase ?? "Created"] ?? 3);
        if (byPhase !== 0) return byPhase;
        return a.metadata.name.localeCompare(b.metadata.name);
      });
  }, [data?.data, search]);

  const openVersion = (engine: Engine, version: string) =>
    go({
      to: `/${workspace}/engines/show/${engine.metadata.name}`,
      query: { version },
      type: "push",
    });

  return (
    <ListPage canCreate={false}>
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={t("engines.list.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {isLoading ? (
        <Loader className="h-4 text-primary" />
      ) : engines.length === 0 ? (
        <EmptyState>{t("engines.list.empty")}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {engines.map((engine) => (
            <EngineCard
              key={engine.id}
              engine={engine}
              onSelectVersion={(version) => openVersion(engine, version)}
            />
          ))}
        </div>
      )}
    </ListPage>
  );
};
