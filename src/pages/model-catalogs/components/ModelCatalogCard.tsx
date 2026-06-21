import { useGo } from "@refinedev/core";
import { Rocket, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import EndpointEngine from "@/domains/endpoint/components/EndpointEngine";
import ModelTask from "@/domains/endpoint/components/ModelTask";
import ModelCatalogStatus from "@/domains/model-catalog/components/ModelCatalogStatus";
import { ModelInfoBadges } from "@/domains/model-catalog/components/ModelInfoBadges";
import type { ModelCatalog } from "@/domains/model-catalog/types";
import { useDeleteHelper } from "@/foundation/hooks/use-delete-helper";
import { useTranslation } from "@/foundation/lib/i18n";
import type { ModelSpec } from "@/foundation/types/serving-types";

// pickRepresentativeModel returns the model a card uses for its headline fields.
// Recipe MCs carry the model per variant (no top-level spec.model), so fall
// back to the default variant (or the first one) — a card only needs one
// representative checkpoint to summarize.
function pickRepresentativeModel(spec: ModelCatalog["spec"]): ModelSpec | null {
  if (spec.model?.name) return spec.model;
  const variants = spec.variants ?? {};
  if (variants.default?.model) return variants.default.model;
  for (const v of Object.values(variants)) {
    if (v?.model) return v.model;
  }
  return null;
}

type Props = {
  catalog: ModelCatalog;
  workspace: string;
  showWorkspace?: boolean;
};

export const ModelCatalogCard = ({
  catalog,
  workspace,
  showWorkspace,
}: Props) => {
  const { t } = useTranslation();
  const go = useGo();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const id = String(catalog.id);
  const model = pickRepresentativeModel(catalog.spec);
  const name = catalog.metadata.name;
  const variantCount = Object.keys(catalog.spec.variants ?? {}).length;

  const { mutate: deleteCatalog, isLoading: isDeleting } = useDeleteHelper(
    "model_catalogs",
    id,
    { workspace: catalog.metadata.workspace },
  );

  const goShow = () =>
    go({
      to: `/${workspace}/model-catalogs/show/${id}`,
      type: "push",
    });

  const goDeploy = () =>
    go({
      to: `/${workspace}/endpoints/create`,
      query: { model_catalog: id },
      type: "push",
    });

  return (
    <Card className="flex flex-col h-full hover:border-primary/40 transition-colors">
      <CardContent className="flex flex-col gap-3 flex-1 pt-5">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={goShow}
            className="text-left font-medium leading-tight hover:text-primary hover:underline break-all"
          >
            {name}
          </button>
          <ModelCatalogStatus {...catalog.status} />
        </div>

        {model ? (
          <div className="text-xs font-mono text-muted-foreground break-all">
            {model.name}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {model?.task ? <ModelTask task={model.task} /> : null}
          {variantCount > 1 ? (
            <span className="text-xs text-muted-foreground">
              {t("model_catalogs.card.variantCount", "{{count}} variants", {
                count: variantCount,
              })}
            </span>
          ) : null}
        </div>

        <ModelInfoBadges info={model?.info} />

        <div className="text-xs text-muted-foreground mt-auto">
          <EndpointEngine spec={catalog.spec} metadata={catalog.metadata} />
        </div>

        {showWorkspace ? (
          <div className="text-xs text-muted-foreground">
            {t("common.fields.workspace", "Workspace")}:{" "}
            {catalog.metadata.workspace}
          </div>
        ) : null}
      </CardContent>

      <div className="flex items-center gap-2 border-t px-4 py-2.5">
        <Button size="sm" className="flex-1" onClick={goDeploy}>
          <Rocket className="size-4 mr-1.5" />
          {t("model_catalogs.card.deploy", "Deploy")}
        </Button>
        <Button size="sm" variant="outline" onClick={goShow}>
          {t("model_catalogs.card.details", "Details")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
          aria-label={t("buttons.delete", "Delete")}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("model_catalogs.card.deleteTitle", "Delete model catalog")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("model_catalogs.card.deleteDescription", {
                name,
                defaultValue: `Delete "${name}"? This cannot be undone.`,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("buttons.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={() => {
                deleteCatalog();
                setConfirmOpen(false);
              }}
            >
              {t("buttons.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
