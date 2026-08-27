import { useGo } from "@refinedev/core";
import { MoreHorizontal, Pencil, Rocket, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import Timestamp from "@/foundation/components/Timestamp";
import { useRegistryModelVersion } from "@/foundation/hooks/use-registry-model-version";
import { useTranslation } from "@/foundation/lib/i18n";
import { registryAcceptsWrites } from "@/foundation/lib/model-registry-visibility";
import type { ModelRegistry } from "../types";
import { ModelDeleteDialog } from "./ModelDeleteDialog";
import { ModelEditDialog } from "./ModelEditDialog";
import { ModelInfoFields } from "./ModelInfoFields";
import { ModelReadme } from "./ModelReadme";

type ModelSelection = {
  model: string;
  version: string;
};

type Props = {
  workspace: string;
  registry: ModelRegistry;
  selection: ModelSelection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SummaryItem = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="inline-flex min-w-0 items-baseline gap-1.5 text-sm leading-6">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <span className="min-w-0 font-medium text-foreground">{children}</span>
  </div>
);

export const ModelDetailDrawer = ({
  workspace,
  registry,
  selection,
  open,
  onOpenChange,
}: Props) => {
  const { t } = useTranslation();
  const go = useGo();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const modelRef = {
    workspace,
    registry: registry.metadata.name,
    model: selection?.model,
    version: selection?.version,
  };
  const { model, isLoading, error, refetch } =
    useRegistryModelVersion(modelRef);
  const canWrite = registryAcceptsWrites(registry.visibility);

  const deploy = () => {
    if (!selection || !model) return;
    go({
      to: `/${workspace}/endpoints/create`,
      query: {
        model_registry: registry.metadata.name,
        model: selection.model,
        version: model.name,
      },
      type: "push",
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[720px] flex-col gap-0 border-l-[var(--nt-stroke-neutral-trans-2)] bg-card p-0 sm:max-w-[720px]"
        data-testid="model-detail-drawer"
      >
        <SheetHeader className="border-b px-6 py-5 pr-14">
          <SheetDescription className="mb-1 break-all text-xs leading-5">
            {registry.metadata.name}
          </SheetDescription>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SheetTitle className="min-w-0 flex-1 break-words text-xl leading-8">
              {selection?.model ?? ""}
            </SheetTitle>

            {model && selection ? (
              <div className="flex shrink-0 items-center gap-2">
                <Button onClick={deploy} data-testid="model-deploy">
                  <Rocket className="mr-1.5 h-4 w-4" />
                  {t("model_catalogs.card.deploy", "Deploy")}
                </Button>
                {canWrite ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={t("table.actions")}
                        data-testid="model-actions-trigger"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(true)}>
                        <Pencil className="h-4 w-4" />
                        {t("model_registries.models.actions.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        data-variant="destructive"
                        onSelect={() => setDeleting(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("buttons.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            ) : null}
          </div>
          {selection && model ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-xs leading-5 text-muted-foreground">
              <span>{model.name}</span>
              {model.size ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{model.size}</span>
                </>
              ) : null}
            </div>
          ) : null}
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader className="h-6 text-muted-foreground" />
            </div>
          ) : error ? (
            <EmptyState variant="section" data-testid="model-detail-error">
              <div className="text-destructive">{error.message}</div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => refetch()}
              >
                {t("buttons.refresh")}
              </Button>
            </EmptyState>
          ) : model && selection ? (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-1 border-b bg-[var(--nt-fill-neutral-trans-1)] px-6 py-3">
                {registry.visibility !== "public" ? (
                  <SummaryItem
                    label={t("model_registries.models.fields.alias")}
                  >
                    {model.alias || "-"}
                  </SummaryItem>
                ) : null}
                <SummaryItem label={t("model_registries.fields.visibility")}>
                  {registry.visibility
                    ? t(`model_registries.visibility.${registry.visibility}`)
                    : t("model_registries.models.values.unknown")}
                </SummaryItem>
                <SummaryItem label={t("common.fields.createdAt")}>
                  {model.creation_time ? (
                    <Timestamp timestamp={model.creation_time} relative />
                  ) : (
                    <span className="text-[var(--nt-text-neutral-quaternary)]">
                      {t("model_registries.models.values.unknown")}
                    </span>
                  )}
                </SummaryItem>
              </div>

              <div className="w-0 min-w-full px-6 pb-6">
                <section className="py-5">
                  <h3 className="text-base font-semibold leading-6 text-foreground">
                    {t("model_registries.models.detail.infoSection")}
                  </h3>
                  <p className="mb-3 mt-1 text-sm leading-5 text-[var(--nt-text-neutral-tertiary)]">
                    {t("model_registries.models.detail.infoHint")}
                  </p>
                  <ModelInfoFields
                    info={model.info}
                    variant="definition-table"
                  />
                </section>
                <Separator />
                <div className="pt-5">
                  <ModelReadme
                    modelRef={{
                      workspace,
                      registry: registry.metadata.name,
                      model: selection.model,
                      version: model.name,
                    }}
                    framed={false}
                    contentFramed
                  />
                </div>
              </div>
            </>
          ) : null}
        </ScrollArea>

        {selection && model ? (
          <>
            <ModelEditDialog
              open={canWrite && editing}
              onOpenChange={setEditing}
              modelRef={{
                workspace,
                registry: registry.metadata.name,
                model: selection.model,
                version: model.name,
              }}
              modelName={selection.model}
              alias={model.alias}
              info={model.info}
            />
            <ModelDeleteDialog
              open={canWrite && deleting}
              onOpenChange={setDeleting}
              modelRef={{
                workspace,
                registry: registry.metadata.name,
                model: selection.model,
                version: model.name,
              }}
              modelName={selection.model}
              onDeleted={() => onOpenChange(false)}
            />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
