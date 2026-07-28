import { useList, useParsed } from "@refinedev/core";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ModelCatalog } from "@/domains/model-catalog/types";
import { EmptyState } from "@/foundation/components/EmptyState";
import { ListPage } from "@/foundation/components/ListPage";
import { Loader } from "@/foundation/components/Loader";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";
import { ImportDialog } from "./components/ImportDialog";
import { ModelCatalogCard } from "./components/ModelCatalogCard";

// Catalog is now a card-first surface (design §3.7): each card summarizes a
// model and offers a one-click Deploy entry, replacing the long parameter
// table. Catalog supports import only, so the list keeps a single Import entry.
export const ModelCatalogsList = () => {
  const { t } = useTranslation();
  const { params } = useParsed();
  const workspace = (params?.workspace as string) ?? "";
  const isAllWorkspaces = workspace === ALL_WORKSPACES;

  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useList<ModelCatalog>({
    resource: "model_catalogs",
    pagination: { mode: "off" },
    meta: { workspace },
    queryOptions: { enabled: Boolean(workspace) },
  });

  const catalogs = useMemo(() => {
    const all = data?.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => {
      const name = c.metadata.name?.toLowerCase() ?? "";
      const modelName = (
        c.spec.model?.name ??
        Object.values(c.spec.variants ?? {})[0]?.model?.name ??
        ""
      ).toLowerCase();
      return name.includes(q) || modelName.includes(q);
    });
  }, [data?.data, search]);

  return (
    <ListPage
      canCreate={false}
      extra={
        <Button size="sm" onClick={() => setImportOpen(true)}>
          <Download className="size-4 mr-1.5 rotate-180" />
          {t("model_catalogs.import.button", "Import")}
        </Button>
      }
    >
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={t(
            "model_catalogs.card.searchPlaceholder",
            "Search by name",
          )}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Loader className="h-4 text-primary" />
      ) : catalogs.length === 0 ? (
        <EmptyState>
          {t(
            "model_catalogs.card.empty",
            "No model catalogs yet. Import one to get started.",
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {catalogs.map((catalog) => (
            <ModelCatalogCard
              key={catalog.id}
              catalog={catalog}
              showWorkspace={isAllWorkspaces}
            />
          ))}
        </div>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </ListPage>
  );
};
