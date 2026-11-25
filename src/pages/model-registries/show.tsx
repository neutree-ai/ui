import { useParsed, useShow } from "@refinedev/core";
import { useSearchParams } from "react-router-dom";
import { ModelDetailDrawer } from "@/domains/model-registry/components/ModelDetailDrawer";
import { RegistryAvailabilityNotice } from "@/domains/model-registry/components/RegistryAvailabilityNotice";
import { RegistryModelsTable } from "@/domains/model-registry/components/RegistryModelsTable";
import { modelRegistryHeaderFields } from "@/domains/model-registry/lib/detail-fields";
import { modelRegistryPhases } from "@/domains/model-registry/lib/phases";
import { registryIsProvisioned } from "@/domains/model-registry/lib/provisioning";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { Loader } from "@/foundation/components/Loader";
import { useTranslation } from "@/foundation/lib/i18n";
import { MODEL_REGISTRY_SELECT } from "@/foundation/model-reference/model-registry-visibility";
import {
  type RegistryModelSelection,
  readRegistryModelSelection,
  writeRegistryModelSelection,
} from "@/foundation/model-reference/registry-model-link";
import { PhaseStatus } from "@/foundation/role/PhaseStatus";
import { DetailFields } from "@/foundation/scene/DetailFields";
import { MetadataTimestampMeta } from "@/foundation/scene/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/scene/ShowPage";

export const ModelRegistriesShow = () => {
  const { t } = useTranslation();
  const { params } = useParsed();
  // The open model lives in the URL so another page can link straight to it —
  // the endpoint detail page does (NEU-736).
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedModel = readRegistryModelSelection(searchParams);
  const setSelectedModel = (selection: RegistryModelSelection | null) =>
    setSearchParams((prev) => writeRegistryModelSelection(prev, selection));
  const {
    query: { data, isLoading },
  } = useShow<ModelRegistry>({
    // `visibility` decides what this page offers, and it is a computed field —
    // absent unless it is named. See MODEL_REGISTRY_SELECT.
    meta: { select: MODEL_REGISTRY_SELECT },
  });
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  // The route names the workspace, so read it from there. The record's own
  // field is nullable, and defaulting it to "" would leave the models tab
  // querying nothing and silently showing an empty list — an outcome with no
  // symptom, which is the one thing worse than an error.
  const workspace = (params?.workspace as string | undefined) ?? "";

  // A provisioned registry is configured by a neutree-core setting and refuses
  // both writes, so neither control is offered. See registryIsProvisioned.
  const isProvisioned = registryIsProvisioned(record);

  return (
    <ShowPage
      record={record}
      canEdit={!isProvisioned}
      canDelete={!isProvisioned}
      showCurrentBreadcrumb={false}
    >
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        status={
          <PhaseStatus status={record.status} phases={modelRegistryPhases} />
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <DetailFields
              inline
              fields={modelRegistryHeaderFields}
              record={record}
            />
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3 overflow-auto">
        <div className="empty:hidden">
          <RegistryAvailabilityNotice workspace={workspace} registry={record} />
        </div>
        <RegistryModelsTable
          workspace={workspace}
          registry={record}
          onModelSelect={(model, version) =>
            setSelectedModel({ model, version })
          }
        />
      </div>
      <ModelDetailDrawer
        workspace={workspace}
        registry={record}
        selection={selectedModel}
        open={selectedModel !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedModel(null);
        }}
      />
    </ShowPage>
  );
};
