import { useShow, useUpdate } from "@refinedev/core";
import yaml from "js-yaml";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CatalogModelSlots } from "@/domains/model-catalog/components/CatalogModelSlots";
import {
  type ParseCatalogSpecError,
  parseCatalogSpecYaml,
} from "@/domains/model-catalog/lib/parse-catalog-spec-yaml";
import type { ModelCatalog } from "@/domains/model-catalog/types";
import { Loader } from "@/foundation/components/Loader";
import { PageHeader } from "@/foundation/components/PageHeader";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  type ResourceEntity,
  serializeToYaml,
  transformEntityForExport,
} from "@/foundation/lib/yaml-transform";

type Translate = ReturnType<typeof useTranslation>["t"];

function describeParseError(e: ParseCatalogSpecError, t: Translate): string {
  switch (e.type) {
    case "syntax":
      return e.message;
    case "notAMapping":
      return t("model_catalogs.edit.invalidSpec", "Spec must be a mapping");
    case "missingSpec":
      return t(
        "model_catalogs.edit.missingSpec",
        "This looks like a ModelCatalog document but has no spec. Paste the whole document, or just the spec body.",
      );
    case "wrongKind":
      return t(
        "model_catalogs.wrongKind",
        'Expected kind ModelCatalog, got "{{kind}}"',
        { kind: e.kind },
      );
    case "nameMismatch":
      return t(
        "model_catalogs.edit.nameMismatch",
        'This document is for "{{actual}}", but you are editing "{{expected}}". Import it as a new catalog instead.',
        { actual: e.actual, expected: e.expected },
      );
    case "workspaceMismatch":
      return t(
        "model_catalogs.edit.workspaceMismatch",
        'This document belongs to workspace "{{actual}}", but this catalog is in "{{expected}}".',
        { actual: e.actual, expected: e.expected },
      );
  }
}

// Catalog edit is a YAML editor over the whole document. Recipe MCs have a
// deeply nested shape (base/variants/features) with no flat field form, and
// every other catalog surface — import, export — speaks whole documents, so
// the editor shows one too: what you see is what a save applies, and a
// document copied from anywhere else pastes in as-is.
//
// A save carries back `spec` plus the metadata that is allowed to change
// (labels, annotations). Identity is immutable — editing name or workspace is
// rejected rather than ignored — and the timestamps are server-owned.
export const ModelCatalogsEdit = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspace } = useParams<{ workspace: string }>();
  const {
    query: { data, isLoading },
  } = useShow<ModelCatalog>({});
  const record = data?.data;

  const goToShow = () =>
    navigate(`/${workspace}/model-catalogs/show/${record?.metadata.name}`);

  const { mutateAsync, isLoading: isSaving } = useUpdate<ModelCatalog>();
  const [specYaml, setSpecYaml] = useState("");
  // The editor's text is the source of truth; the model panel reads this and
  // hands a changed document back, which is serialized straight over the text.
  // Null while the text does not parse, which the panel renders as such.
  const parsedDoc = useMemo(() => {
    try {
      return yaml.load(specYaml) ?? null;
    } catch {
      return null;
    }
  }, [specYaml]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      // Seed through the export helpers so the editor round-trips with YAML
      // export and import: no status, no ids, no server-owned timestamps.
      setSpecYaml(
        serializeToYaml([
          transformEntityForExport(record as unknown as ResourceEntity, {
            removeStatus: true,
            removeIds: true,
            removeTimestamps: true,
            includeCredentials: true,
          }),
        ]),
      );
    }
  }, [record]);

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const handleSave = async () => {
    const parsed = parseCatalogSpecYaml(specYaml, {
      name: record.metadata.name,
      workspace: record.metadata.workspace,
    });
    if (!parsed.ok) {
      setError(describeParseError(parsed.error, t));
      return;
    }
    setError(null);
    try {
      await mutateAsync({
        resource: "model_catalogs",
        id: record.metadata.name,
        values: {
          ...record,
          metadata: { ...record.metadata, ...parsed.metadata },
          spec: parsed.spec,
        },
        mutationMode: "pessimistic",
        meta: {
          idColumnName: "metadata->name",
          workspace: record.metadata.workspace,
          workspaced: true,
        },
        successNotification: false,
        errorNotification: false,
      });
      toast.success(t("model_catalogs.edit.saved", "Catalog updated"));
      goToShow();
    } catch (e) {
      toast.error(getErrorMessage(e, t("common.errors.unknown")));
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={t("model_catalogs.edit.title", "Edit model catalog")}
      />
      <div className="pt-4 grow overflow-auto">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">
                  {t("common.fields.name", "Name")}
                </div>
                <div className="font-medium">{record.metadata.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">
                  {t("common.fields.workspace", "Workspace")}
                </div>
                <div className="font-medium">
                  {record.metadata.workspace || "-"}
                </div>
              </div>
            </div>

            {/* The one edit almost every imported catalog needs, lifted out of
            the YAML: the models it names have to point at this workspace's
            registries. It rewrites the text below rather than holding a copy,
            so hand-editing and using the panel stay interchangeable. */}
            <div className="space-y-1.5">
              <div className="text-sm font-medium">
                {t("model_catalogs.models.title")}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("model_catalogs.models.hint")}
              </p>
              <CatalogModelSlots
                doc={parsedDoc}
                onChange={(nextDoc) =>
                  setSpecYaml(
                    serializeToYaml([nextDoc as Record<string, unknown>]),
                  )
                }
                workspace={record.metadata.workspace ?? ""}
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-medium">
                {t("model_catalogs.edit.specLabel", "Catalog (YAML)")}
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "model_catalogs.edit.specHint",
                  "Edit the catalog, or paste a whole ModelCatalog document over it. Spec, labels and annotations are applied; name and workspace cannot change. Invalid recipes surface as a Failed status after saving.",
                )}
              </p>
              <Textarea
                data-testid="catalog-spec-yaml"
                className="font-mono text-xs h-[28rem]"
                value={specYaml}
                onChange={(e) => setSpecYaml(e.target.value)}
                spellCheck={false}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => goToShow()}>
                {t("buttons.cancel", "Cancel")}
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
                {t("buttons.save", "Save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
