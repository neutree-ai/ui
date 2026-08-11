import { useOne } from "@refinedev/core";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ModelDeleteDialog } from "@/domains/model-registry/components/ModelDeleteDialog";
import { ModelEditDialog } from "@/domains/model-registry/components/ModelEditDialog";
import { ModelInfoFields } from "@/domains/model-registry/components/ModelInfoFields";
import { ModelReadme } from "@/domains/model-registry/components/ModelReadme";
import { useRegistryModelVersion } from "@/domains/model-registry/hooks/use-registry-model-version";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import Timestamp from "@/foundation/components/Timestamp";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  MODEL_REGISTRY_SELECT,
  registryAcceptsWrites,
} from "@/foundation/lib/model-registry-visibility";

/**
 * One model version inside a registry.
 *
 * Every value on this page comes from the server as-is. Where the server could
 * not establish a field it says so, and the page says so too — see
 * ModelInfoFields, which is where that decision is written down.
 *
 * The edit and delete controls are offered to everyone, as everything else in
 * this UI is: the API is what decides who may write, and a refusal is reported
 * where the action was taken rather than pre-empted here.
 *
 * They are, however, only offered where writing is *possible*. A read-only
 * registry refuses every write there is, so the controls are absent rather than
 * present-and-doomed — a different judgement from permissions, and made from the
 * registry's stated capability rather than from what kind of registry it is.
 */
export const ModelRegistryModelShow = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const workspace = params.workspace ?? "";
  const registry = params.id ?? "";
  const modelName = params.model ?? "";
  const version = searchParams.get("version") ?? undefined;

  const modelRef = { workspace, registry, model: modelName, version };
  const { model, isLoading, error, refetch } =
    useRegistryModelVersion(modelRef);

  // The registry decides what this page may offer, and only says so when
  // `visibility` is selected — see MODEL_REGISTRY_SELECT.
  const { data: registryData } = useOne<ModelRegistry>({
    resource: "model_registries",
    id: registry,
    meta: { select: MODEL_REGISTRY_SELECT, workspaced: true, workspace },
    queryOptions: { enabled: Boolean(workspace && registry) },
  });
  const registryRecord = registryData?.data;
  // Fail closed, in both directions. No answer yet means no controls — showing
  // them and taking them away again is worse than showing them a moment late —
  // and a registry that answered *without* stating its visibility means the
  // request forgot to select the field, which loses two buttons rather than
  // offering a dialogue whose only outcome is a refusal.
  const canWrite =
    registryRecord?.visibility !== undefined &&
    registryAcceptsWrites(registryRecord.visibility);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const registryHref = `/${workspace}/model-registries/show/${encodeURIComponent(
    registry,
  )}`;

  const breadcrumb = (
    <div className="flex min-h-9 w-full items-center">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={`#${registryHref}`}>
              {registry}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{modelName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );

  const content = () => {
    if (isLoading) {
      return <Loader className="h-4 text-primary" />;
    }

    if (error) {
      return (
        <EmptyState variant="page" data-testid="model-detail-error">
          <div className="text-destructive">{error.message}</div>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => refetch()}
            data-testid="model-detail-retry"
          >
            {t("buttons.refresh")}
          </Button>
        </EmptyState>
      );
    }

    if (!model) {
      return <div>{t("pages.error.notFound")}</div>;
    }

    const labels = Object.entries(model.labels ?? {});

    return (
      <>
        <ShowPage.ObjectHeader
          title={modelName}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
              <ShowPage.Meta label={t("model_registries.models.fields.alias")}>
                {model.alias || (
                  <span className="text-muted-foreground">-</span>
                )}
              </ShowPage.Meta>
              <ShowPage.Meta label={t("common.fields.version")}>
                {model.name}
              </ShowPage.Meta>
              <ShowPage.Meta label={t("model_registries.fields.modelRegistry")}>
                {registry}
              </ShowPage.Meta>
            </span>
          }
          actions={
            canWrite ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setEditing(true)}
                  data-testid="model-edit-open"
                >
                  {t("model_registries.models.actions.edit")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeleting(true)}
                  data-testid="model-delete-open"
                >
                  {t("buttons.delete")}
                </Button>
              </>
            ) : null
          }
        />

        <div className="mt-4 space-y-4">
          <ShowPage.Section title={t("common.sections.basicInformation")}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
              <ShowPage.Row title={t("common.fields.name")}>
                {modelName}
              </ShowPage.Row>
              <ShowPage.Row title={t("common.fields.version")}>
                {model.name}
              </ShowPage.Row>
              <ShowPage.Row title={t("model_registries.models.fields.size")}>
                {model.size || (
                  <span className="text-muted-foreground">
                    {t("model_registries.models.values.unknown")}
                  </span>
                )}
              </ShowPage.Row>
              <ShowPage.Row title={t("common.fields.createdAt")}>
                {/* A registry that relays somebody else's catalogue does not
                    always know when a revision was created, and answers with an
                    empty string. Unknown is the honest reading; handing "" to a
                    date formatter renders "Invalid date", which reads as a bug in
                    this page rather than as a gap in what the registry knows. */}
                {model.creation_time ? (
                  <Timestamp timestamp={model.creation_time} />
                ) : (
                  <span className="text-muted-foreground">
                    {t("model_registries.models.values.unknown")}
                  </span>
                )}
              </ShowPage.Row>
              <ShowPage.Row title={t("common.fields.labels")}>
                {labels.length === 0 ? (
                  <span className="text-muted-foreground">-</span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {labels.map(([key, value]) => (
                      <Badge key={key} variant="secondary">
                        {key}: {value}
                      </Badge>
                    ))}
                  </span>
                )}
              </ShowPage.Row>
            </div>
          </ShowPage.Section>

          <ShowPage.Section
            title={t("model_registries.models.detail.infoSection")}
            description={t("model_registries.models.detail.infoHint")}
          >
            <ModelInfoFields info={model.info} />
          </ShowPage.Section>

          <ModelReadme modelRef={{ ...modelRef, version: model.name }} />
        </div>

        {/* Not rendered at all where writing is impossible, so there is no
            dialogue to open by other means either. */}
        <ModelEditDialog
          open={canWrite && editing}
          onOpenChange={setEditing}
          modelRef={{ ...modelRef, version: model.name }}
          modelName={modelName}
          alias={model.alias}
          info={model.info}
        />
        <ModelDeleteDialog
          open={canWrite && deleting}
          onOpenChange={setDeleting}
          modelRef={{ ...modelRef, version: model.name }}
          modelName={modelName}
          onDeleted={() => navigate(registryHref)}
        />
      </>
    );
  };

  return (
    <ShowPage canEdit={false} canDelete={false} breadcrumb={breadcrumb}>
      {content()}
    </ShowPage>
  );
};
