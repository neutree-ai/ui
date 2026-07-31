import { useShow, useUpdate } from "@refinedev/core";
import yaml from "js-yaml";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ModelCatalog } from "@/domains/model-catalog/types";
import { Loader } from "@/foundation/components/Loader";
import { PageHeader } from "@/foundation/components/PageHeader";
import { useTranslation } from "@/foundation/lib/i18n";

// Catalog edit is a focused spec editor. Recipe MCs have a deeply nested
// shape (base/variants/features) with no flat field form, so we expose the
// spec as YAML — the same surface users author on import. Editing the model
// reference (e.g. swapping a HuggingFace model for a locally-imported one)
// is a single field change in that YAML. Identity (name/workspace) is
// immutable and shown read-only; only `spec` is PATCHed.
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setSpecYaml(yaml.dump(record.spec, { sortKeys: false, lineWidth: 120 }));
    }
  }, [record]);

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const handleSave = async () => {
    let parsedSpec: ModelCatalog["spec"];
    try {
      parsedSpec = yaml.load(specYaml) as ModelCatalog["spec"];
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    if (!parsedSpec || typeof parsedSpec !== "object") {
      setError(t("model_catalogs.edit.invalidSpec", "Spec must be a mapping"));
      return;
    }
    setError(null);
    try {
      await mutateAsync({
        resource: "model_catalogs",
        id: record.metadata.name,
        values: { ...record, spec: parsedSpec },
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
      toast.error(e instanceof Error ? e.message : String(e));
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

            <div className="space-y-1.5">
              <div className="text-sm font-medium">
                {t("model_catalogs.edit.specLabel", "Spec (YAML)")}
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "model_catalogs.edit.specHint",
                  "Edit the catalog spec — e.g. point the model at a locally-imported registry. Invalid recipes surface as a Failed status after saving.",
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
