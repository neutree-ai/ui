import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Path, PathValue } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Combobox as AsyncCombobox } from "@/components/ui/combobox";
import { CommandLoading } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { EndpointCatalogOrigin } from "@/domains/endpoint/components/EndpointCatalogOrigin";
import { EndpointClusterGpuResourcesPanel } from "@/domains/endpoint/components/EndpointClusterGpuResourcesPanel";
import { EndpointConfigurationSummary } from "@/domains/endpoint/components/EndpointConfigurationSummary";
import { EndpointDeploymentSummary } from "@/domains/endpoint/components/EndpointDeploymentSummary";
import { EndpointKVCacheFields } from "@/domains/endpoint/components/EndpointKVCacheFields";
import {
  EndpointResolvedModelEditor,
  type VariantResetNotice,
} from "@/domains/endpoint/components/EndpointResolvedModelEditor";
import { FeaturePicker } from "@/domains/endpoint/components/FeaturePicker";
import type { KVCacheEstimateState } from "@/domains/endpoint/components/KVCacheEstimate";
import { ModelOptionalFields } from "@/domains/endpoint/components/ModelOptionalFields";
import { formatTaskName } from "@/domains/endpoint/components/ModelTask";
import { VariantPicker } from "@/domains/endpoint/components/VariantPicker";
import { WorkloadImageFeatureAddon } from "@/domains/endpoint/components/WorkloadImageFeatureAddon";
import { WorkloadImageInput } from "@/domains/endpoint/components/WorkloadImageInput";
import { useEndpointClusterResources } from "@/domains/endpoint/hooks/use-endpoint-cluster-resources";
import { useEndpointEngineOptions } from "@/domains/endpoint/hooks/use-endpoint-engine-options";
import useEndpointResources from "@/domains/endpoint/hooks/use-endpoint-resources";
import { useKvCacheAvailability } from "@/domains/endpoint/hooks/use-kv-cache-availability";
import {
  buildCatalogOriginAnnotations,
  readCatalogOrigin,
} from "@/domains/endpoint/lib/catalog-origin";
import {
  buildCatalogMergedSpec,
  defaultEndpointSpec,
  isResourceRequestExceeded,
  normalizeEndpointRecordForForm,
  normalizeEndpointResourcesForForm,
  transformEndpointValues,
  validateEndpointValues,
} from "@/domains/endpoint/lib/endpoint-form-helpers";
import { endpointValuesEqual } from "@/domains/endpoint/lib/endpoint-review-changes";
import { endpointStepCompletions } from "@/domains/endpoint/lib/endpoint-wizard";
import {
  findEngineCacheArgControls,
  readEngineCacheArgs,
} from "@/domains/endpoint/lib/engine-cache-args";
import {
  estimateCheckpointWeightsGb,
  estimateModelWeightsGb,
  perReplicaRequiredGb,
} from "@/domains/endpoint/lib/estimate-weights";
import {
  type EndpointReviewCapacityMetric,
  type EndpointReviewContext,
  formatCapacityValue,
} from "@/domains/endpoint/lib/review-context";
import {
  formatVgpuMemoryGiBInputValue,
  getEffectiveVgpuMemoryMiB,
  getRoundedVgpuMemoryGiBValue,
  isVgpuVirtualizationResourceSupported,
  normalizeVgpuMemoryGiBInput,
  VGPU_VIRTUALIZATION_CORE_PERCENT_RESOURCE_KEY,
  VGPU_VIRTUALIZATION_MEMORY_MIB_RESOURCE_KEY,
} from "@/domains/endpoint/lib/vgpu";
import {
  endpointZCacheOptions,
  isValidKvCacheTimeout,
} from "@/domains/endpoint/lib/zcache";
import type {
  Endpoint,
  EndpointClusterRef,
  EndpointEngineRef,
  EndpointModelCatalogRef,
  EndpointModelRegistryRef,
  ModelSpec,
  ResourceSpec,
} from "@/domains/endpoint/types";
import { EmptyState } from "@/foundation/components/EmptyState";
import { EMPTY_VALUE, EmptyValue } from "@/foundation/components/EmptyValue";
import FormCardGrid, {
  FORM_GRID_GAP_CLASS,
} from "@/foundation/components/FormCardGrid";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { InfoHint } from "@/foundation/components/InfoHint";
import { NumberInput } from "@/foundation/components/NumberInput";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
import { VariablesInput } from "@/foundation/components/VariablesInput";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import { useRegistryModelVersion } from "@/foundation/hooks/use-registry-model-version";
import { useRegistryModels } from "@/foundation/hooks/use-registry-models";
import type { Schema } from "@/foundation/hooks/use-variables-input";
import {
  isValidWorkspace,
  useWorkspace,
} from "@/foundation/hooks/use-workspace";
import type { RegistryModelRef } from "@/foundation/lib/api/registry-models";
import { engineNeedsModelSpec } from "@/foundation/lib/engine-model-spec";
import { nestFieldErrors } from "@/foundation/lib/form-errors";
import {
  addBackEndpointDeviceAllocationsToNodeResources,
  calculateGpuPlacementCapacity,
  calculatePhysicalCardUsageForRequest,
  calculateVgpuCardCapacity,
  calculateVgpuMemoryBoundaryMiB,
  calculateVgpuPhysicalCardUsage,
  countFullCardAvailableDevicesByProduct,
  sumMatchingDeviceAvailableResources,
} from "@/foundation/lib/gpu-device-resources";
import { resolveModelInfoRead } from "@/foundation/lib/model-info-read";
import { registryUnavailability } from "@/foundation/lib/model-registry-availability";
import {
  MODEL_REGISTRY_SELECT,
  registryModelDelivery,
} from "@/foundation/lib/model-registry-visibility";
import { registryModelLabel } from "@/foundation/lib/registry-model-display";
import { cn } from "@/foundation/lib/utils";
import {
  newestVersion,
  sortVersionsNewestFirst,
} from "@/foundation/lib/version-order";
import {
  composeEndpointSpec,
  defaultFeatureSelections,
} from "@/foundation/recipe/compose";
import { DEFAULT_VARIANT, isRecipeShape } from "@/foundation/recipe/normalize";
import type {
  ComposedSpec,
  FeatureSelection,
  RecipeFeature,
  RecipeInputSpec,
} from "@/foundation/recipe/types";
import { formatGb, matchesAcceleratorName } from "@/foundation/recipe/vram";

// Reads the query string off the current URL. The app uses a HashRouter so
// the query lives in location.hash ("#/ws/endpoints/create?model_catalog=1").
// Returns null when absent or outside a browser (e.g. unit tests), so callers
// can treat it as "no preselection".
function readHashQueryParams(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash ?? "";
  const q = hash.indexOf("?");
  if (q === -1) return null;
  return new URLSearchParams(hash.slice(q + 1));
}

function readModelCatalogQueryParam(): string {
  return readHashQueryParams()?.get("model_catalog") ?? "";
}

type RegistryModelPreselection = {
  registry: string;
  model: string;
  version?: string;
};

type ModelIdentity = Pick<
  ModelSpec,
  "registry" | "name" | "version" | "file" | "task"
>;

type ModelSourceMode = "catalog" | "manual";

type VariantResetSnapshot = {
  notice: VariantResetNotice;
  variant: string;
  model: ModelIdentity;
  editing: boolean;
};

type ModelSourceDraft = {
  model: ModelIdentity;
  editing: boolean;
  customized: boolean;
};

const MODEL_OVERRIDE_KEYS = [
  "registry",
  "name",
  "version",
  "file",
] as const satisfies ReadonlyArray<Exclude<keyof ModelIdentity, "task">>;

const COMPOSED_SPEC_FIELD_KEYS = [
  "model",
  "engine",
  "resources",
  "variables",
  "env",
] as const;

const modelIdentity = (
  model:
    | Pick<ModelSpec, "registry" | "name" | "version" | "file" | "task">
    | null
    | undefined,
): ModelIdentity => ({
  registry: model?.registry ?? "",
  name: model?.name ?? "",
  version: model?.version ?? "",
  file: model?.file ?? "",
  task: model?.task ?? "",
});

const countModelChanges = (current: ModelIdentity, derived: ModelIdentity) =>
  MODEL_OVERRIDE_KEYS.filter((key) => current[key] !== derived[key]).length;

export function readRegistryModelQueryParams(): RegistryModelPreselection | null {
  const params = readHashQueryParams();
  if (!params) return null;

  const registry = params.get("model_registry") ?? "";
  const model = params.get("model") ?? "";
  if (!registry || !model) return null;

  return {
    registry,
    model,
    version: params.get("version") || undefined,
  };
}

type AcceleratorVirtualization = NonNullable<
  ResourceSpec["accelerator"]
>["virtualization"];
type GpuAllocationMode = "full" | "vgpu";

/** How many models the picker asks for. The dropdown searches server side, so
 * this bounds one response rather than the registry. */
const MODEL_PICKER_PAGE_SIZE = 20;

const hasVgpuVirtualizationValues = (
  virtualization: AcceleratorVirtualization | undefined,
) => Boolean(virtualization?.memory_mib);

const userSetValueOptions = {
  shouldDirty: true,
  shouldTouch: true,
  shouldValidate: true,
} as const;

const derivedValueOptions = (hasError: boolean) => ({
  shouldDirty: true,
  // A derived change may fill a field that already shows an error, but it must
  // not surface a new required error merely because the field appeared.
  shouldValidate: hasError,
});

const formatOneDecimal = (value: number | null | undefined) => {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue.toFixed(1) : "0.0";
};

const formatInputNumber = (value: number | null | undefined) => {
  if (value == null) return "";
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? String(numberValue) : "";
};

const getCapacityBadgeClassName = (exceeded: boolean) =>
  exceeded
    ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-50"
    : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-50";

export const useEndpointForm = ({ action }: { action: "create" | "edit" }) => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();
  const [preselectCatalogId] = useState(() =>
    action === "create" ? readModelCatalogQueryParam() : "",
  );
  const [preselectRegistryModel] = useState(() =>
    action === "create" ? readRegistryModelQueryParams() : null,
  );
  const startsInManualMode = action === "create" && !preselectCatalogId;
  const [selectedModelCatalog, setSelectedModelCatalog] = useState<string>("");
  const [modelSearch, setModelSearch] = useState("");
  // Recipe-mode state: only meaningful when the selected catalog is a Recipe MC.
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [featureSelections, setFeatureSelections] = useState<
    FeatureSelection[]
  >([]);
  const [modelSourceMode, setModelSourceMode] = useState<ModelSourceMode>(
    startsInManualMode ? "manual" : "catalog",
  );
  const [resolvedModelEditing, setResolvedModelEditing] =
    useState(startsInManualMode);
  const [resolvedModelCustomized, setResolvedModelCustomized] = useState(false);
  const [variantResetNotice, setVariantResetNotice] =
    useState<VariantResetNotice | null>(null);
  const [variantResetSnapshot, setVariantResetSnapshot] =
    useState<VariantResetSnapshot | null>(null);
  const [catalogModelDraft, setCatalogModelDraft] =
    useState<ModelSourceDraft | null>(null);
  const [manualModelDraft, setManualModelDraft] =
    useState<ModelSourceDraft | null>(null);
  const [gpuAllocationModeChoice, setGpuAllocationModeChoice] =
    useState<GpuAllocationMode | null>(null);
  const effectiveGpuAllocationModeRef = useRef<GpuAllocationMode>("full");
  // Accelerator types the selected engine version ships images for; empty
  // while the engine is unknown, which leaves every accelerator acceptable.
  const engineAcceleratorTypesRef = useRef<string[]>([]);
  // Why ZCache cannot serve the current selection; null while it can.
  const kvCacheUnavailableRef = useRef<string | null>(null);

  const form = useForm<Endpoint>({
    // Required fields stay quiet until they are touched or a global submit is
    // attempted. Once an error is visible, the same field revalidates on every
    // change so a correcting edit clears it immediately.
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      api_version: "v1",
      kind: "Endpoint",
      metadata: {
        name: "",
        workspace: isValidWorkspace(currentWorkspace) ? currentWorkspace : "",
      },
      spec: defaultEndpointSpec,
    },
    refineCoreProps: {
      autoSave: {
        enabled: false,
      },
      queryOptions: {
        select: (response) => ({
          ...response,
          data: response.data
            ? normalizeEndpointRecordForForm(response.data as Endpoint)
            : response.data,
        }),
      },
      errorNotification: false,
    },
    warnWhenUnsavedChanges: true,
    resolver: (values) => {
      const fieldErrors = validateEndpointValues(
        values.spec,
        {
          action,
          currentRegistry,
          currentModelName,
          availableModelNames: modelExistenceNames,
          availableRegistryNames: modelRegistryNames,
          clusterType,
          hidesModelFields,
          allocationMode: effectiveGpuAllocationModeRef.current,
        },
        t,
      );
      const acceleratorType = values.spec?.resources?.accelerator?.type;
      const engineAcceleratorTypes = engineAcceleratorTypesRef.current;
      if (
        acceleratorType &&
        engineAcceleratorTypes.length > 0 &&
        !engineAcceleratorTypes.includes(acceleratorType) &&
        !fieldErrors["spec.resources.accelerator"]
      ) {
        fieldErrors["spec.resources.accelerator"] = {
          type: "manual",
          message: t("endpoints.messages.engineAcceleratorIncompatible"),
        };
      }
      if (
        values.spec?.kv_cache?.provider === "zcache" &&
        kvCacheUnavailableRef.current &&
        !fieldErrors["spec.kv_cache"]
      ) {
        fieldErrors["spec.kv_cache"] = {
          type: "manual",
          message: t("endpoints.kvCacheSettings.requirements"),
        };
      }
      const kvCache = values.spec?.kv_cache;
      if (
        kvCache?.provider === "zcache" &&
        !isValidKvCacheTimeout(kvCache.options?.timeout_seconds)
      ) {
        fieldErrors["spec.kv_cache.options.timeout_seconds"] = {
          type: "manual",
          message: t("endpoints.kvCacheSettings.invalidTimeout"),
        };
      }
      if (!values.metadata?.name?.trim()) {
        fieldErrors["metadata.name"] = {
          type: "manual",
          message: t("common.validation.nameRequired"),
        };
      }
      if (!isValidWorkspace(values.metadata?.workspace)) {
        fieldErrors["metadata.workspace"] = {
          type: "manual",
          message: t("common.validation.workspaceRequired"),
        };
      }
      return { values, errors: nestFieldErrors<Endpoint>(fieldErrors) };
    },
  });

  const syncedQueryResourcesKeyRef = useRef<string | null>(null);

  const watchedResources = form.watch("spec.resources");
  const watchedReplicaCount = form.watch("spec.replicas.num");
  const normalizedResources = normalizeEndpointResourcesForForm(
    watchedResources as unknown as Record<string, unknown> | null | undefined,
  );
  const queryEndpoint = form.refineCore.query?.data?.data as
    | Endpoint
    | undefined;
  const currentCache = form.watch("spec.kv_cache");
  const cacheChanged =
    action === "edit" &&
    !endpointValuesEqual(currentCache, queryEndpoint?.spec?.kv_cache);
  const queryResources = queryEndpoint?.spec?.resources as
    | Record<string, unknown>
    | null
    | undefined;
  const normalizedQueryResources = useMemo(
    () => normalizeEndpointResourcesForForm(queryResources),
    [queryResources],
  );

  const workspace = form.watch("metadata.workspace");
  const currentModelName = form.watch("spec.model.name");
  const currentRegistry = form.watch("spec.model.registry");
  const currentModelVersion = form.watch("spec.model.version");
  const currentModelFile = form.watch("spec.model.file");
  const currentModelTask = form.watch("spec.model.task");
  const currentModelValues = useMemo<ModelIdentity>(
    () => ({
      registry: currentRegistry ?? "",
      name: currentModelName ?? "",
      version: currentModelVersion ?? "",
      file: currentModelFile ?? "",
      task: currentModelTask ?? "",
    }),
    [
      currentRegistry,
      currentModelName,
      currentModelVersion,
      currentModelFile,
      currentModelTask,
    ],
  );
  const currentCluster = form.watch("spec.cluster");
  const engineSpec = form.watch("spec.engine");
  // An engine that needs no spec.model has nothing to ask about: the registry,
  // model, version, file and task fields are all hidden for it. spec.model.task
  // is still set from the engine's declared tasks when the engine is picked, so
  // the gateway keeps routing the endpoint as that task.
  const hidesModelFields = !engineNeedsModelSpec(engineSpec?.engine);

  const selectedAccelerator = normalizedResources?.accelerator;
  const gpuUsage = normalizedResources?.gpu || 0;
  const replicaCount = Math.max(1, Number(watchedReplicaCount || 1));

  const meta = useMemo(
    () => ({
      workspace,
      workspaced: true,
    }),
    [workspace],
  );

  const clusters = useSelect<EndpointClusterRef>({
    resource: "clusters",
    meta,
  });

  const cacheEnabled = form.watch("spec.kv_cache.provider") === "zcache";
  const cacheNodeNames = new Set(
    endpointZCacheOptions(
      clusters.query.data?.data.find(
        (cluster) => cluster.metadata.name === currentCluster,
      ),
    )?.target_nodes ?? [],
  );
  const currentEndpointRuntimeResources = queryEndpoint?.status?.resources;
  // Releasing an allocation outside the cache pool does not free capacity
  // inside that pool. Only credit allocations whose nodes are still eligible.
  const currentAllocationInCachePool = Boolean(
    currentEndpointRuntimeResources?.replicas?.length &&
      currentEndpointRuntimeResources.replicas.every(
        (replica) => replica.node_id && cacheNodeNames.has(replica.node_id),
      ),
  );

  const currentEndpointAccelerator = normalizedQueryResources?.accelerator;
  const currentEndpointReplicaCount =
    action === "edit"
      ? Math.max(1, Number(queryEndpoint?.spec?.replicas?.num || 1))
      : 0;
  const isEditingCurrentCluster = Boolean(
    action === "edit" &&
      queryEndpoint?.spec?.cluster &&
      queryEndpoint.spec.cluster === currentCluster,
  );
  const canReuseCurrentEndpointResources =
    isEditingCurrentCluster && (!cacheEnabled || currentAllocationInCachePool);
  const canReuseCurrentEndpointAccelerator = Boolean(
    canReuseCurrentEndpointResources &&
      selectedAccelerator?.type &&
      selectedAccelerator?.product &&
      currentEndpointAccelerator?.type === selectedAccelerator.type &&
      currentEndpointAccelerator?.product === selectedAccelerator.product,
  );
  const canReuseCurrentEndpointDeviceAllocations = Boolean(
    canReuseCurrentEndpointAccelerator &&
      currentEndpointRuntimeResources?.replicas?.some(
        (replica) => (replica.devices?.length ?? 0) > 0,
      ),
  );
  const isCurrentEndpointVgpuAllocation = hasVgpuVirtualizationValues(
    currentEndpointAccelerator?.virtualization,
  );
  const originalEndpointUsage = useEndpointResources(
    action === "edit" ? (normalizedQueryResources ?? undefined) : undefined,
    action === "edit" ? queryEndpoint?.metadata : undefined,
  );
  const currentUsage = {
    cpu: canReuseCurrentEndpointResources ? originalEndpointUsage.cpu : 0,
    memory: canReuseCurrentEndpointResources ? originalEndpointUsage.memory : 0,
    gpu:
      canReuseCurrentEndpointAccelerator && !isCurrentEndpointVgpuAllocation
        ? originalEndpointUsage.gpu
        : 0,
  };

  const engines = useSelect<EndpointEngineRef>({
    resource: "engines",
    meta,
  });

  const modelRegistries = useSelect<EndpointModelRegistryRef>({
    resource: "model_registries",
    // `visibility` says whether the chosen registry's models are already on
    // local storage or fetched when the endpoint starts, which is worth knowing
    // before deploying rather than after. It is a computed field, so it only
    // arrives when named — see MODEL_REGISTRY_SELECT.
    meta: { ...meta, select: MODEL_REGISTRY_SELECT },
  });

  // What the chosen registry costs at deploy time. Read from the registry's
  // stated visibility rather than its type, so a second public provider inherits
  // the warning instead of needing a branch added here.
  //
  // A registry that has not arrived yet is not an answer, so nothing is claimed
  // until one is in hand. Once one *is* in hand and still says nothing, that is
  // the forgotten-`select` case, and it gets said out loud below rather than
  // silently reading as "already local".
  const selectedRegistry = (modelRegistries.query.data?.data ?? []).find(
    (candidate) => candidate.metadata.name === currentRegistry,
  );
  const selectedModelDelivery = selectedRegistry
    ? registryModelDelivery(selectedRegistry.visibility)
    : null;

  // The registries this workspace can offer, or null while the listing has not
  // arrived — which is not the same statement as "there are none".
  const modelRegistryNames = useMemo<string[] | null>(
    () =>
      modelRegistries.query.data?.data
        ? modelRegistries.query.data.data.map(
            (registry) => registry.metadata.name,
          )
        : null,
    [modelRegistries.query.data],
  );

  // A registry that is not answering, or is on its way out, cannot be listed
  // from. Offered but unselectable, with the reason on the row: removing it
  // would leave the user looking for a registry they know they created.
  const modelRegistryOptions = useMemo(
    () =>
      (modelRegistries.query.data?.data ?? []).map((registry) => {
        const unavailable = registryUnavailability(registry);

        return {
          label: registry.metadata.name,
          value: registry.metadata.name,
          disabled: Boolean(unavailable),
          description: unavailable
            ? t(`common.modelRegistry.${unavailable}`)
            : undefined,
        };
      }),
    [modelRegistries.query.data, t],
  );

  const modelCatalogs = useSelect<EndpointModelCatalogRef>({
    resource: "model_catalogs",
    meta,
  });

  const {
    selectedCluster,
    schedulingResourceInfo,
    clusterResources,
    acceleratorOptions,
    selectedAcceleratorOption,
    maxAvailable,
    gpuStep,
  } = useEndpointClusterResources({
    currentCluster,
    clustersData: clusters.query.data?.data,
    selectedAccelerator,
    currentUsage,
    t,
    cacheEnabled,
  });
  const kvCacheAvailability = useKvCacheAvailability({
    cluster: selectedCluster,
    acceleratorType: selectedAccelerator?.type,
    engine: engineSpec,
    task: currentModelTask,
    cacheStatusLoading: clusters.query.isFetching,
  });
  kvCacheUnavailableRef.current = kvCacheAvailability.unavailableReason;
  const hasClusterCapacityEvidence = Boolean(
    selectedCluster?.status?.resource_info,
  );

  const clusterType: "ssh" | "kubernetes" | undefined =
    selectedCluster?.spec?.type === "ssh"
      ? "ssh"
      : selectedCluster?.spec?.type === "kubernetes"
        ? "kubernetes"
        : undefined;

  const isEdit = action === "edit";
  const sectionVariant = "section";

  const clusterOptions = useMemo(() => {
    const options = (clusters.query?.data?.data || []).map((cluster) => ({
      label: cluster.metadata.name,
      value: cluster.metadata.name,
    }));

    if (
      !isEdit ||
      !currentCluster ||
      options.some((option) => option.value === currentCluster)
    ) {
      return options;
    }

    return [{ label: currentCluster, value: currentCluster }, ...options];
  }, [clusters.query?.data?.data, currentCluster, isEdit]);

  const selectedVirtualization = selectedAccelerator?.virtualization;
  const isSelectedClusterVgpuEnabled =
    selectedCluster?.spec.type === "kubernetes" &&
    selectedCluster.spec.accelerator_virtualization?.enabled === true;
  const hasResolvedClusterSelection = Boolean(
    currentCluster && selectedCluster,
  );
  const showVgpuFields = Boolean(
    isSelectedClusterVgpuEnabled &&
      selectedAccelerator?.type &&
      selectedAccelerator?.product,
  );
  // The cluster's accelerator virtualization status reports which virtualization
  // resource keys its mode supports (backend AcceleratorVirtualizationStatus
  // .supported_resources). Inputs for resources outside the supported set are
  // disabled so the form cannot build a spec the backend would reject (e.g.
  // core_percent when the list omits it). The UI gates on supported_resources
  // only — not the mode name.
  const supportedVirtualizationResources =
    selectedCluster?.status?.accelerator_virtualization?.supported_resources;
  const isVgpuMemoryResourceSupported = isVgpuVirtualizationResourceSupported(
    supportedVirtualizationResources,
    VGPU_VIRTUALIZATION_MEMORY_MIB_RESOURCE_KEY,
  );
  const isVgpuCoreResourceSupported = isVgpuVirtualizationResourceSupported(
    supportedVirtualizationResources,
    VGPU_VIRTUALIZATION_CORE_PERCENT_RESOURCE_KEY,
  );
  const selectedClusterNodeCount = useMemo(() => {
    const nodeResources =
      selectedCluster?.status?.resource_info?.node_resources;
    if (nodeResources) {
      return Object.keys(nodeResources).length;
    }

    return selectedCluster?.status?.ready_nodes ?? null;
  }, [
    selectedCluster?.status?.ready_nodes,
    selectedCluster?.status?.resource_info?.node_resources,
  ]);
  const selectedMemoryTotalMiB = selectedAcceleratorOption?.memoryTotalMiB;
  const effectiveVgpuMemoryMiB = getEffectiveVgpuMemoryMiB(
    selectedVirtualization,
    selectedMemoryTotalMiB,
  );
  const canUseVgpuAllocation = showVgpuFields && isVgpuMemoryResourceSupported;
  const inferredGpuAllocationMode: GpuAllocationMode =
    canUseVgpuAllocation && hasVgpuVirtualizationValues(selectedVirtualization)
      ? "vgpu"
      : "full";
  const effectiveGpuAllocationMode: GpuAllocationMode =
    canUseVgpuAllocation && gpuAllocationModeChoice === "vgpu"
      ? "vgpu"
      : inferredGpuAllocationMode;
  effectiveGpuAllocationModeRef.current = effectiveGpuAllocationMode;
  const isVgpuAllocationMode = effectiveGpuAllocationMode === "vgpu";
  const isVgpuCapacityPending =
    isVgpuAllocationMode && effectiveVgpuMemoryMiB === null;
  let gpuInputStep = gpuStep;
  if (isVgpuAllocationMode || gpuUsage >= 1) {
    gpuInputStep = 1;
  }
  const vgpuCoreUnitsPerCard = Number(
    selectedVirtualization?.core_percent || 0,
  );
  const isCurrentEndpointRequestUnchanged = Boolean(
    isEdit &&
      canReuseCurrentEndpointAccelerator &&
      normalizedQueryResources &&
      currentEndpointReplicaCount === replicaCount &&
      Number(normalizedQueryResources.cpu || 0) ===
        Number(normalizedResources?.cpu || 0) &&
      Number(normalizedQueryResources.memory || 0) ===
        Number(normalizedResources?.memory || 0) &&
      Number(normalizedQueryResources.gpu || 0) ===
        Number(normalizedResources?.gpu || 0) &&
      JSON.stringify(
        normalizedQueryResources.accelerator?.virtualization ?? null,
      ) === JSON.stringify(selectedAccelerator?.virtualization ?? null),
  );
  const reusableNodeResources = useMemo(
    () =>
      addBackEndpointDeviceAllocationsToNodeResources(
        schedulingResourceInfo?.node_resources,
        isEditingCurrentCluster ? currentEndpointRuntimeResources : undefined,
        selectedAccelerator,
        isEditingCurrentCluster
          ? {
              cpuPerReplica: normalizedQueryResources?.cpu,
              memoryPerReplica: normalizedQueryResources?.memory,
            }
          : undefined,
      ),
    [
      currentEndpointRuntimeResources,
      isEditingCurrentCluster,
      normalizedQueryResources?.cpu,
      normalizedQueryResources?.memory,
      selectedAccelerator,
      schedulingResourceInfo?.node_resources,
    ],
  );
  const matchingDeviceAvailableResources = useMemo(
    () =>
      sumMatchingDeviceAvailableResources(
        reusableNodeResources,
        selectedAccelerator,
      ),
    [reusableNodeResources, selectedAccelerator],
  );
  const vgpuCardCapacity = useMemo(
    () =>
      calculateVgpuCardCapacity(reusableNodeResources, {
        selectedAccelerator,
        memoryMiBPerCard: effectiveVgpuMemoryMiB,
        coreUnitsPerCard: vgpuCoreUnitsPerCard,
      }),
    [
      reusableNodeResources,
      selectedAccelerator,
      effectiveVgpuMemoryMiB,
      vgpuCoreUnitsPerCard,
    ],
  );
  const hasSelectedDeviceResources =
    matchingDeviceAvailableResources.memoryMiB > 0 ||
    matchingDeviceAvailableResources.coreUnits > 0;
  const requestedVirtualCards = gpuUsage * replicaCount;
  const requestedFullGpuCards = gpuUsage * replicaCount;
  const requestedVgpuMemoryMiB = effectiveVgpuMemoryMiB
    ? requestedVirtualCards * effectiveVgpuMemoryMiB
    : 0;
  const requestedVgpuCoreUnits = vgpuCoreUnitsPerCard
    ? requestedVirtualCards * vgpuCoreUnitsPerCard
    : 0;
  const isFractionalGpuAllocationMode =
    !isVgpuAllocationMode && gpuUsage > 0 && gpuUsage < 1;
  const nonVgpuPhysicalCardUsage = useMemo(
    () =>
      calculatePhysicalCardUsageForRequest(reusableNodeResources, {
        allocationMode: isFractionalGpuAllocationMode ? "fractional" : "full",
        selectedAccelerator,
        requestedPerReplica: gpuUsage,
        replicaCount,
      }),
    [
      reusableNodeResources,
      selectedAccelerator,
      gpuUsage,
      replicaCount,
      isFractionalGpuAllocationMode,
    ],
  );
  const placementCapacity = useMemo(() => {
    if (
      !currentCluster ||
      !selectedAccelerator?.product ||
      gpuUsage <= 0 ||
      isVgpuCapacityPending ||
      isCurrentEndpointRequestUnchanged
    ) {
      return null;
    }

    return calculateGpuPlacementCapacity(reusableNodeResources, {
      allocationMode: isVgpuAllocationMode
        ? "vgpu"
        : isFractionalGpuAllocationMode
          ? "fractional"
          : "full",
      coreUnitsPerCard: vgpuCoreUnitsPerCard,
      cpuPerReplica: normalizedResources?.cpu,
      gpuPerReplica: gpuUsage,
      memoryMiBPerCard: effectiveVgpuMemoryMiB,
      memoryPerReplica: normalizedResources?.memory,
      replicaCount,
      selectedAccelerator,
    });
  }, [
    currentCluster,
    effectiveVgpuMemoryMiB,
    gpuUsage,
    isFractionalGpuAllocationMode,
    isCurrentEndpointRequestUnchanged,
    isVgpuAllocationMode,
    isVgpuCapacityPending,
    normalizedResources?.cpu,
    normalizedResources?.memory,
    replicaCount,
    reusableNodeResources,
    selectedAccelerator,
    vgpuCoreUnitsPerCard,
  ]);
  const vgpuPhysicalCardUsage = useMemo(
    () =>
      isVgpuAllocationMode
        ? calculateVgpuPhysicalCardUsage(reusableNodeResources, {
            allocationMode: "vgpu",
            coreUnitsPerCard: vgpuCoreUnitsPerCard,
            cpuPerReplica: normalizedResources?.cpu,
            gpuPerReplica: gpuUsage,
            memoryMiBPerCard: effectiveVgpuMemoryMiB,
            memoryPerReplica: normalizedResources?.memory,
            replicaCount,
            selectedAccelerator,
          })
        : null,
    [
      effectiveVgpuMemoryMiB,
      gpuUsage,
      isVgpuAllocationMode,
      normalizedResources?.cpu,
      normalizedResources?.memory,
      replicaCount,
      reusableNodeResources,
      selectedAccelerator,
      vgpuCoreUnitsPerCard,
    ],
  );
  const availableFullGpuCards = useMemo(() => {
    if (!selectedAccelerator?.product) {
      return 0;
    }

    if (isFractionalGpuAllocationMode) {
      return nonVgpuPhysicalCardUsage.available;
    }

    const availableDeviceCount = countFullCardAvailableDevicesByProduct(
      reusableNodeResources,
    ).get(selectedAccelerator.product);

    return (
      availableDeviceCount ??
      selectedAcceleratorOption?.available ??
      maxAvailable.gpu.available
    );
  }, [
    maxAvailable.gpu.available,
    isFractionalGpuAllocationMode,
    nonVgpuPhysicalCardUsage.available,
    selectedAccelerator?.product,
    selectedAcceleratorOption?.available,
    reusableNodeResources,
  ]);
  const reusableFullGpuCards =
    canReuseCurrentEndpointAccelerator &&
    !canReuseCurrentEndpointDeviceAllocations &&
    !isCurrentEndpointVgpuAllocation
      ? Number(normalizedQueryResources?.gpu || 0) * currentEndpointReplicaCount
      : 0;
  const maxFullGpuCards =
    selectedAcceleratorOption?.total || maxAvailable.gpu.total || 0;
  const fullGpuCardCapacity =
    maxFullGpuCards > 0
      ? Math.min(availableFullGpuCards + reusableFullGpuCards, maxFullGpuCards)
      : availableFullGpuCards + reusableFullGpuCards;
  const additionalFullGpuCards = Math.max(
    0,
    requestedFullGpuCards - reusableFullGpuCards,
  );
  const reusableFractionalReplicaSlots =
    isFractionalGpuAllocationMode && gpuUsage > 0
      ? Math.floor(reusableFullGpuCards / gpuUsage)
      : 0;
  const fractionalGpuPlacementCapacity =
    nonVgpuPhysicalCardUsage.placementCapacity + reusableFractionalReplicaSlots;
  const currentEndpointProductUsage =
    canReuseCurrentEndpointAccelerator &&
    isCurrentEndpointVgpuAllocation &&
    selectedAccelerator?.product
      ? form.refineCore.query?.data?.data?.status?.resources?.summary
          ?.products?.[selectedAccelerator.product]
      : undefined;
  // Device-level addBack is authoritative when matching device resources are
  // available. Without that topology, retain the endpoint summary so legacy
  // aggregate validation compares only the additional vGPU memory/core.
  const shouldReuseVgpuSummary =
    !canReuseCurrentEndpointDeviceAllocations || !hasSelectedDeviceResources;
  const reusableVgpuMemoryMiB = Number(
    shouldReuseVgpuSummary ? currentEndpointProductUsage?.memory_mib || 0 : 0,
  );
  const reusableVgpuCoreUnits = Number(
    shouldReuseVgpuSummary ? currentEndpointProductUsage?.core_units || 0 : 0,
  );
  const reusableVirtualCards = effectiveVgpuMemoryMiB
    ? vgpuCoreUnitsPerCard > 0
      ? Math.min(
          Math.floor(reusableVgpuMemoryMiB / effectiveVgpuMemoryMiB),
          Math.floor(reusableVgpuCoreUnits / vgpuCoreUnitsPerCard),
        )
      : Math.floor(reusableVgpuMemoryMiB / effectiveVgpuMemoryMiB)
    : 0;
  // Keep physical-card and virtual-allocation counts separate: the first
  // drives card presentation, while the second is the legacy request delta
  // when topology cannot be simulated.
  const reusableVgpuAllocationCounts = useMemo(() => {
    if (!canReuseCurrentEndpointDeviceAllocations) {
      return { physicalCards: 0, virtualCards: 0 };
    }

    const deviceIds = new Set<string>();
    let virtualCards = 0;
    for (const replica of queryEndpoint?.status?.resources?.replicas ?? []) {
      for (const device of replica.devices ?? []) {
        if (
          selectedAccelerator?.product &&
          device.product !== selectedAccelerator.product
        ) {
          continue;
        }

        // addBackEndpointDeviceAllocationsToNodeResources also keys on uuid,
        // so uuid-less devices are never added back; counting them here
        // would diverge from the availability model (and deduplicating them
        // across replicas without a stable key is impossible).
        if (!device.uuid) {
          continue;
        }

        deviceIds.add(device.uuid);
        virtualCards += 1;
      }
    }

    return { physicalCards: deviceIds.size, virtualCards };
  }, [
    canReuseCurrentEndpointDeviceAllocations,
    queryEndpoint?.status?.resources?.replicas,
    selectedAccelerator?.product,
  ]);
  const reusableVgpuPhysicalCards =
    reusableVgpuAllocationCounts.physicalCards > 0
      ? reusableVgpuAllocationCounts.physicalCards
      : reusableVirtualCards;
  const reusableVgpuVirtualCards =
    reusableVgpuAllocationCounts.virtualCards > 0
      ? reusableVgpuAllocationCounts.virtualCards
      : reusableVirtualCards;
  const hasRawAvailableVgpuMemoryMiB =
    hasSelectedDeviceResources ||
    Number.isFinite(selectedAcceleratorOption?.virtualizationMemoryMiB);
  const rawAvailableVgpuMemoryMiB = hasSelectedDeviceResources
    ? matchingDeviceAvailableResources.memoryMiB
    : Number(selectedAcceleratorOption?.virtualizationMemoryMiB || 0);
  const rawAvailableVgpuCoreUnits = hasSelectedDeviceResources
    ? matchingDeviceAvailableResources.coreUnits
    : Number(selectedAcceleratorOption?.virtualizationCoreUnits || 0);
  const availableVgpuMemoryMiB =
    rawAvailableVgpuMemoryMiB + reusableVgpuMemoryMiB;
  const availableVgpuCoreUnits =
    rawAvailableVgpuCoreUnits + reusableVgpuCoreUnits;
  const fallbackVgpuAvailablePhysicalCards =
    selectedAcceleratorOption?.available ?? maxAvailable.gpu.available;
  const fallbackVgpuMaxPhysicalCards =
    selectedAcceleratorOption?.total ||
    maxAvailable.gpu.total ||
    vgpuCardCapacity.matchingDeviceCount;
  const availableVirtualPhysicalCards = hasSelectedDeviceResources
    ? vgpuCardCapacity.totalCards
    : fallbackVgpuAvailablePhysicalCards;
  const uncappedVirtualCardCapacity =
    availableVirtualPhysicalCards + reusableVgpuPhysicalCards;
  const totalVirtualCardCapacity =
    fallbackVgpuMaxPhysicalCards > 0
      ? Math.min(uncappedVirtualCardCapacity, fallbackVgpuMaxPhysicalCards)
      : uncappedVirtualCardCapacity;
  // Cards are requested across replicas (gpu per replica × replica count),
  // so the displayed request and the capacity check must compare totals:
  // a per-replica value alone stays under capacity while the summed request
  // would leave one or more replicas unschedulable.
  const displayedVirtualCards = requestedVirtualCards;
  const displayedVgpuPhysicalCards =
    vgpuPhysicalCardUsage ?? displayedVirtualCards;
  const rawVgpuMemoryBoundaryMiB = (() => {
    const rawMaxMiB =
      typeof selectedMemoryTotalMiB === "number" &&
      Number.isFinite(selectedMemoryTotalMiB)
        ? selectedMemoryTotalMiB
        : null;
    const boundaryRequestedCardCount = requestedVirtualCards;
    if (hasSelectedDeviceResources) {
      const deviceBoundaryMiB = calculateVgpuMemoryBoundaryMiB(
        reusableNodeResources,
        {
          selectedAccelerator,
          requestedCardCount: boundaryRequestedCardCount,
          coreUnitsPerCard: vgpuCoreUnitsPerCard,
        },
      );
      if (deviceBoundaryMiB !== null) {
        return rawMaxMiB === null
          ? deviceBoundaryMiB
          : Math.min(rawMaxMiB, deviceBoundaryMiB);
      }
    }
    if (!hasRawAvailableVgpuMemoryMiB && reusableVgpuMemoryMiB <= 0) {
      return rawMaxMiB;
    }
    const requestedCardCount = Math.max(1, boundaryRequestedCardCount);
    const perCardBoundaryMiB = Math.floor(
      availableVgpuMemoryMiB / requestedCardCount,
    );
    if (!Number.isFinite(perCardBoundaryMiB)) {
      return rawMaxMiB;
    }
    const boundedPerCardMiB = Math.max(0, perCardBoundaryMiB);
    return rawMaxMiB === null
      ? boundedPerCardMiB
      : Math.min(rawMaxMiB, boundedPerCardMiB);
  })();
  const vgpuMemoryGiBMaxValue = getRoundedVgpuMemoryGiBValue(
    rawVgpuMemoryBoundaryMiB,
  );
  const vgpuMemoryGiBInputValue =
    selectedVirtualization?.memory_mib !== undefined
      ? formatVgpuMemoryGiBInputValue(
          selectedVirtualization.memory_mib,
          selectedMemoryTotalMiB,
          rawVgpuMemoryBoundaryMiB,
        )
      : effectiveVgpuMemoryMiB
        ? formatVgpuMemoryGiBInputValue(
            effectiveVgpuMemoryMiB,
            selectedMemoryTotalMiB,
            rawVgpuMemoryBoundaryMiB,
          )
        : "";
  const currentRequestAvailableCoreUnits = isVgpuAllocationMode
    ? availableVgpuCoreUnits
    : 0;
  const currentRequestCoreUnitsPerCard = isVgpuAllocationMode
    ? vgpuCoreUnitsPerCard
    : 0;
  const currentRequestCoreUnits = isVgpuAllocationMode
    ? requestedVgpuCoreUnits
    : 0;
  const handleGpuAllocationModeChange = (next: GpuAllocationMode) => {
    if (next === effectiveGpuAllocationMode) return;

    setGpuAllocationModeChoice(next);
    if (next === "full") {
      form.setValue("spec.resources.accelerator.virtualization", undefined, {
        shouldDirty: true,
        shouldValidate: false,
      });
      form.clearErrors("spec.resources.accelerator.virtualization.memory_mib");
      form.clearErrors(
        "spec.resources.accelerator.virtualization.core_percent",
      );
    }
  };
  // Cards are requested across replicas (gpu per replica × replica count);
  // only the additional cards beyond what the edited endpoint already holds
  // must fit the cluster's available capacity, mirroring the full-GPU check
  // (a per-replica-only comparison lets multi-replica requests
  // through that the scheduler cannot place).
  const additionalVirtualCards = Math.max(
    0,
    requestedVirtualCards - reusableVgpuVirtualCards,
  );
  const isVgpuCardCapacityExceeded = Boolean(
    isVgpuAllocationMode &&
      selectedAccelerator?.product &&
      additionalVirtualCards > availableVirtualPhysicalCards,
  );
  const additionalVgpuMemoryMiB = Math.max(
    0,
    requestedVgpuMemoryMiB - reusableVgpuMemoryMiB,
  );
  const additionalVgpuCoreUnits = Math.max(
    0,
    requestedVgpuCoreUnits - reusableVgpuCoreUnits,
  );
  const isLegacyVgpuCapacityExceeded = Boolean(
    isVgpuAllocationMode &&
      !isVgpuCapacityPending &&
      selectedAccelerator?.product &&
      (isVgpuCardCapacityExceeded ||
        ((rawAvailableVgpuMemoryMiB > 0 || reusableVgpuMemoryMiB > 0) &&
          additionalVgpuMemoryMiB > rawAvailableVgpuMemoryMiB) ||
        ((rawAvailableVgpuCoreUnits > 0 || reusableVgpuCoreUnits > 0) &&
          additionalVgpuCoreUnits > rawAvailableVgpuCoreUnits)),
  );
  const isLegacyFullGpuCapacityExceeded = Boolean(
    !isVgpuAllocationMode &&
      selectedAccelerator?.type &&
      selectedAccelerator?.product &&
      (additionalFullGpuCards > availableFullGpuCards ||
        (isFractionalGpuAllocationMode &&
          replicaCount > fractionalGpuPlacementCapacity)),
  );
  const isPlacementCapacityExceeded = placementCapacity?.overall === "fail";
  const isPlacementCpuCapacityExceeded = placementCapacity?.cpu === "fail";
  const isPlacementMemoryCapacityExceeded =
    placementCapacity?.memory === "fail";
  const isPlacementGpuCapacityExceeded = placementCapacity?.gpu === "fail";
  const hasKnownGpuPlacement = Boolean(
    placementCapacity && placementCapacity.gpu !== "unknown",
  );
  const isVgpuPlacementCapacityExceeded = Boolean(
    isVgpuAllocationMode && isPlacementGpuCapacityExceeded,
  );
  const isFullGpuPlacementCapacityExceeded = Boolean(
    !isVgpuAllocationMode && isPlacementGpuCapacityExceeded,
  );
  const isVgpuCapacityExceeded = hasKnownGpuPlacement
    ? isVgpuPlacementCapacityExceeded
    : isLegacyVgpuCapacityExceeded;
  const isFullGpuCapacityExceeded = hasKnownGpuPlacement
    ? isFullGpuPlacementCapacityExceeded
    : isLegacyFullGpuCapacityExceeded;
  const hasNoMatchingAccelerator = Boolean(
    hasKnownGpuPlacement && placementCapacity?.matchingDeviceCount === 0,
  );
  const hasVgpuMemoryCapacityExceeded = Boolean(
    isVgpuAllocationMode &&
      hasKnownGpuPlacement &&
      !hasNoMatchingAccelerator &&
      requestedVgpuMemoryMiB > 0 &&
      placementCapacity &&
      placementCapacity.totalAvailableMemoryMiB < requestedVgpuMemoryMiB,
  );
  const hasVgpuCoreCapacityExceeded = Boolean(
    isVgpuAllocationMode &&
      hasKnownGpuPlacement &&
      !hasNoMatchingAccelerator &&
      requestedVgpuCoreUnits > 0 &&
      placementCapacity &&
      placementCapacity.totalAvailableCoreUnits < requestedVgpuCoreUnits,
  );
  const hasFullGpuAggregateCardCapacityExceeded = Boolean(
    !isVgpuAllocationMode &&
      !isFractionalGpuAllocationMode &&
      hasKnownGpuPlacement &&
      !hasNoMatchingAccelerator &&
      placementCapacity &&
      placementCapacity.satisfyingDeviceCount < requestedFullGpuCards,
  );
  const hasNoNodeForFractionalGpuReplica = Boolean(
    isFractionalGpuAllocationMode &&
      isPlacementGpuCapacityExceeded &&
      !hasNoMatchingAccelerator &&
      placementCapacity?.maxGpuPlaceableReplicas === 0,
  );
  const hasNoNodeForFullGpuReplica = Boolean(
    !isVgpuAllocationMode &&
      !isFractionalGpuAllocationMode &&
      placementCapacity?.gpu === "fail" &&
      placementCapacity.requestedCardsPerReplica > 1 &&
      !hasFullGpuAggregateCardCapacityExceeded &&
      placementCapacity.maxGpuPlaceableReplicas === 0 &&
      placementCapacity.maxFullGpuCardsPerNode <
        placementCapacity.requestedCardsPerReplica,
  );
  const hasNoNodeForVgpuReplica = Boolean(
    isVgpuAllocationMode &&
      isPlacementGpuCapacityExceeded &&
      !hasNoMatchingAccelerator &&
      !hasVgpuMemoryCapacityExceeded &&
      !hasVgpuCoreCapacityExceeded &&
      placementCapacity?.maxGpuPlaceableReplicas === 0,
  );
  const hasPartialGpuReplicaPlacement = Boolean(
    isPlacementGpuCapacityExceeded &&
      !hasNoMatchingAccelerator &&
      !hasFullGpuAggregateCardCapacityExceeded &&
      !hasVgpuMemoryCapacityExceeded &&
      !hasVgpuCoreCapacityExceeded &&
      placementCapacity?.maxGpuPlaceableReplicas != null &&
      placementCapacity.maxGpuPlaceableReplicas > 0 &&
      placementCapacity.maxGpuPlaceableReplicas < replicaCount,
  );
  const hasNodeCpuPlacementCapacityExceeded = Boolean(
    placementCapacity?.gpu === "pass" &&
      placementCapacity.cpu === "pass" &&
      placementCapacity.cpuPlacement === "fail",
  );
  const hasNodeMemoryPlacementCapacityExceeded = Boolean(
    placementCapacity?.gpu === "pass" &&
      placementCapacity.memory === "pass" &&
      placementCapacity.memoryPlacement === "fail",
  );
  const hasCombinedNodePlacementCapacityExceeded = Boolean(
    placementCapacity?.overall === "fail" &&
      placementCapacity.gpu === "pass" &&
      placementCapacity.cpu === "pass" &&
      placementCapacity.memory === "pass" &&
      placementCapacity.cpuPlacement === "pass" &&
      placementCapacity.memoryPlacement === "pass",
  );
  const isVgpuCapacityExceededWithPlacement = isVgpuCapacityExceeded;
  const isFullGpuCapacityExceededWithPlacement = isFullGpuCapacityExceeded;
  // For known node topology, placementCapacity computes aggregate CPU/memory
  // across all nodes while keeping each replica on a GPU node. maxAvailable is
  // intentionally a single-node input limit, so using it for all replicas
  // would incorrectly report CPU/memory exhaustion when only GPU capacity is
  // exhausted. Retain that legacy check only while placement is unavailable.
  const shouldUseLegacyCpuCapacityCheck =
    !placementCapacity || placementCapacity.cpu === "unknown";
  const shouldUseLegacyMemoryCapacityCheck =
    !placementCapacity || placementCapacity.memory === "unknown";
  const requestedCpuTotal = (normalizedResources?.cpu || 0) * replicaCount;
  const requestedMemoryTotal =
    (normalizedResources?.memory || 0) * replicaCount;
  const isCpuCapacityExceeded =
    Boolean(
      currentCluster &&
        !hasCombinedNodePlacementCapacityExceeded &&
        shouldUseLegacyCpuCapacityCheck &&
        isResourceRequestExceeded(
          requestedCpuTotal,
          maxAvailable.cpu.available,
          maxAvailable.cpu.total,
        ),
    ) ||
    Boolean(isPlacementCpuCapacityExceeded) ||
    hasNodeCpuPlacementCapacityExceeded;
  const isMemoryCapacityExceeded =
    Boolean(
      currentCluster &&
        !hasCombinedNodePlacementCapacityExceeded &&
        shouldUseLegacyMemoryCapacityCheck &&
        isResourceRequestExceeded(
          requestedMemoryTotal,
          maxAvailable.memory.available,
          maxAvailable.memory.total,
        ),
    ) ||
    Boolean(isPlacementMemoryCapacityExceeded) ||
    hasNodeMemoryPlacementCapacityExceeded;
  // Any over-allocated resource blocks deploy (returned as `submitBlocked` and
  // handed to ResourceForm); each card renders its own warning message.
  const isResourceCapacityExceeded =
    hasClusterCapacityEvidence &&
    (isCpuCapacityExceeded ||
      isMemoryCapacityExceeded ||
      isFullGpuCapacityExceededWithPlacement ||
      isVgpuCapacityExceededWithPlacement ||
      isPlacementCapacityExceeded);
  useEffect(() => {
    if (
      hasResolvedClusterSelection &&
      !isSelectedClusterVgpuEnabled &&
      selectedVirtualization
    ) {
      form.setValue("spec.resources.accelerator.virtualization", undefined, {
        ...derivedValueOptions(
          Boolean(
            form.getFieldState("spec.resources.accelerator.virtualization")
              .error,
          ),
        ),
      });
    }
  }, [
    form,
    hasResolvedClusterSelection,
    isSelectedClusterVgpuEnabled,
    selectedVirtualization,
  ]);

  // Clear virtualization values the cluster's supported_resources no longer
  // includes (backend AcceleratorVirtualizationStatus.supported_resources).
  // Disabling the input alone would still submit a stale value that backend
  // admission rejects (e.g. core_percent when the list omits it) and would
  // keep the stale value driving the capacity math.
  useEffect(() => {
    if (!hasResolvedClusterSelection || !selectedVirtualization) return;

    const next = { ...selectedVirtualization };
    let changed = false;

    if (!isVgpuCoreResourceSupported) {
      const corePercent = (selectedVirtualization as Record<string, unknown>)
        .core_percent;
      if (
        corePercent !== undefined &&
        corePercent !== null &&
        corePercent !== ""
      ) {
        delete next.core_percent;
        changed = true;
      }
    }
    if (!isVgpuMemoryResourceSupported) {
      const memoryMiB = (selectedVirtualization as Record<string, unknown>)
        .memory_mib;
      if (memoryMiB !== undefined && memoryMiB !== null && memoryMiB !== "") {
        delete next.memory_mib;
        changed = true;
      }
    }

    if (!changed) return;

    form.setValue(
      "spec.resources.accelerator.virtualization",
      Object.keys(next).length > 0 ? next : undefined,
      derivedValueOptions(
        Boolean(
          form.getFieldState("spec.resources.accelerator.virtualization").error,
        ),
      ),
    );
  }, [
    form,
    hasResolvedClusterSelection,
    isVgpuCoreResourceSupported,
    isVgpuMemoryResourceSupported,
    selectedVirtualization,
  ]);

  useEffect(() => {
    const currentMemoryMiB = Number(selectedVirtualization?.memory_mib);
    if (
      !isVgpuAllocationMode ||
      !Number.isFinite(currentMemoryMiB) ||
      currentMemoryMiB <= 0 ||
      rawVgpuMemoryBoundaryMiB === null ||
      rawVgpuMemoryBoundaryMiB === undefined
    ) {
      return;
    }

    const displayedMemoryGiB = getRoundedVgpuMemoryGiBValue(currentMemoryMiB);
    if (displayedMemoryGiB === null) return;

    const alignedMemoryMiB = normalizeVgpuMemoryGiBInput(
      displayedMemoryGiB,
      selectedMemoryTotalMiB,
      rawVgpuMemoryBoundaryMiB,
    );
    if (
      alignedMemoryMiB === undefined ||
      alignedMemoryMiB === currentMemoryMiB
    ) {
      return;
    }

    form.setValue(
      "spec.resources.accelerator.virtualization",
      {
        ...(selectedVirtualization ?? {}),
        memory_mib: alignedMemoryMiB,
      },
      derivedValueOptions(
        Boolean(
          form.getFieldState("spec.resources.accelerator.virtualization").error,
        ),
      ),
    );
  }, [
    form,
    isVgpuAllocationMode,
    rawVgpuMemoryBoundaryMiB,
    selectedMemoryTotalMiB,
    selectedVirtualization,
  ]);

  const setSingleCardMemoryGiB = (rawValue: string) => {
    // Editing virtual-card memory is an explicit commitment to vGPU mode.
    // Clearing the field must not silently turn the request back into full
    // cards.
    setGpuAllocationModeChoice("vgpu");
    const currentCorePercent = Number(selectedVirtualization?.core_percent);
    const coreOnlyVirtualization =
      Number.isFinite(currentCorePercent) && currentCorePercent > 0
        ? { core_percent: currentCorePercent }
        : undefined;

    if (!rawValue.trim()) {
      form.setValue(
        "spec.resources.accelerator.virtualization",
        coreOnlyVirtualization,
        userSetValueOptions,
      );
      return;
    }

    const memoryGiB = Number.parseFloat(rawValue);
    if (Number.isNaN(memoryGiB)) return;
    if (memoryGiB <= 0) {
      form.setValue(
        "spec.resources.accelerator.virtualization",
        coreOnlyVirtualization,
        userSetValueOptions,
      );
      return;
    }

    const memoryMiB = normalizeVgpuMemoryGiBInput(
      memoryGiB,
      selectedMemoryTotalMiB,
      rawVgpuMemoryBoundaryMiB,
    );
    if (memoryMiB === undefined) return;

    form.setValue(
      "spec.resources.accelerator.virtualization",
      {
        ...(coreOnlyVirtualization ?? {}),
        memory_mib: memoryMiB,
      },
      userSetValueOptions,
    );
  };

  const setCoreLimitPercent = (rawValue: string) => {
    const corePercent = rawValue.trim() ? Number.parseFloat(rawValue) : 0;
    if (Number.isNaN(corePercent)) return;

    const nextVirtualization: AcceleratorVirtualization = {
      ...(selectedVirtualization ?? {}),
    };
    if (corePercent > 0) {
      nextVirtualization.core_percent = corePercent;
    } else {
      delete nextVirtualization.core_percent;
    }

    form.setValue(
      "spec.resources.accelerator.virtualization",
      Object.keys(nextVirtualization).length > 0
        ? nextVirtualization
        : undefined,
      userSetValueOptions,
    );
  };

  const effectiveModelSearch = modelSearch || "";

  const modelsData = useRegistryModels({
    workspace,
    registry: currentRegistry,
    search: effectiveModelSearch || undefined,
    limit: MODEL_PICKER_PAGE_SIZE,
  });

  // Existence lookup for the currently selected model, keyed by the exact
  // model name — deliberately decoupled from the dropdown's `modelSearch`.
  // Validating against the search-coupled list above rejects any model that
  // isn't in whatever page the user last searched. Catalog-template deploys
  // once failed with "Model not found in selected registry" for models
  // that exist upstream. While this query is loading or failed the resolver
  // skips the containment check instead of blocking submit.
  const modelExistenceQuery = useRegistryModels({
    workspace,
    registry: currentRegistry,
    search: currentModelName,
    limit: MODEL_PICKER_PAGE_SIZE,
    enabled: Boolean(action === "create" && currentModelName),
  });
  const modelExistenceNames = useMemo<string[] | null>(() => {
    // null while there is no answer, which is what makes the resolver skip the
    // containment check instead of deciding the model does not exist.
    return modelExistenceQuery.page
      ? modelExistenceQuery.page.models.map((m) => m.name)
      : null;
  }, [modelExistenceQuery.page]);

  // What the checkpoint says about itself lives in the detail read, not in the
  // listing, so picking a model asks for it and the answer lands in the effect
  // below. Only a pick sets this: opening an existing endpoint, or applying a
  // catalog, must keep whatever `info` that spec already carries.
  const [pickedModelRef, setPickedModelRef] = useState<RegistryModelRef | null>(
    null,
  );
  const pickedModelVersion = useRegistryModelVersion(pickedModelRef ?? {});
  const pickedModelInfo = pickedModelVersion.model?.info ?? null;
  const pickedModelSettled =
    Boolean(pickedModelRef) && !pickedModelVersion.isLoading;

  useEffect(() => {
    if (!pickedModelSettled) return;
    // A failed read settles with nothing, which is the honest answer: the field
    // was cleared when the model was picked and stays cleared.
    form.setValue("spec.model.info", pickedModelInfo);
    setPickedModelRef(null);
  }, [pickedModelSettled, pickedModelInfo, form]);

  // A direct registry deployment uses the version's reported size as the
  // weights estimate. Read the current version rather than only the version
  // that was just picked, so edit pages and preselected models get the same
  // value without replaying the picker's info write into the form.
  const directModelSelection = isEdit || modelSourceMode === "manual";
  const modelSizeRef = useMemo<RegistryModelRef | null>(
    () =>
      directModelSelection &&
      !hidesModelFields &&
      workspace &&
      currentRegistry &&
      currentModelName
        ? {
            workspace,
            registry: currentRegistry,
            model: currentModelName,
            version: currentModelVersion || undefined,
          }
        : null,
    [
      currentModelName,
      currentModelVersion,
      currentRegistry,
      directModelSelection,
      hidesModelFields,
      workspace,
    ],
  );
  const modelSizeVersion = useRegistryModelVersion(modelSizeRef ?? {});

  // The resolver only runs on form events, so a lookup result landing after
  // the last user interaction would never surface (or clear) the
  // model-not-found error. Re-validate that one field when the inputs or the
  // result set actually change. `form` is a NEW object every render (refine's
  // useForm spreads the RHF result) and trigger() itself re-renders form
  // state, so an unguarded trigger here loops forever and freezes the page —
  // the ref keeps the effect idempotent per key.
  const modelExistenceKey = modelExistenceNames?.join("\n") ?? null;
  const lastExistenceTriggerKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (action !== "create" || !currentRegistry || !currentModelName) {
      lastExistenceTriggerKeyRef.current = null;
      return;
    }
    const triggerKey = [
      currentRegistry,
      currentModelName,
      modelExistenceKey ?? "",
    ].join("\u0000");
    if (lastExistenceTriggerKeyRef.current === triggerKey) return;
    lastExistenceTriggerKeyRef.current = triggerKey;
    void form.trigger("-model-catalog" as Path<Endpoint>);
  }, [action, currentRegistry, currentModelName, modelExistenceKey, form]);

  const {
    engineNames,
    engineVersions,
    engineTasks,
    engineTasksForVersion,
    engineValueSchema,
    engineVersion,
  } = useEndpointEngineOptions({
    enginesData: engines.query.data?.data,
    engineSpec,
  });
  const defaultEngineInitialized = useRef(false);

  useEffect(() => {
    if (
      action !== "create" ||
      defaultEngineInitialized.current ||
      engineNames.length === 0
    ) {
      return;
    }
    defaultEngineInitialized.current = true;

    if (form.getValues("spec.engine.engine") || !engineNames.includes("vllm")) {
      return;
    }

    const version = newestVersion(engineVersions.vllm ?? []);
    if (!version) return;

    const tasks = engineTasks.vllm ?? [];
    const task = tasks.includes("text-generation")
      ? "text-generation"
      : (tasks[0] ?? "");

    form.setValue("spec.engine", {
      engine: "vllm",
      version: version.version,
    });
    if (!form.getValues("spec.model.task") && task) {
      form.setValue("spec.model.task", task);
    }
  }, [action, engineNames, engineTasks, engineVersions, form]);

  useEffect(() => {
    if (!engineSpec.engine || engineTasksForVersion.length === 0) return;
    const currentTask = form.getValues("spec.model.task");
    if (engineTasksForVersion.includes(currentTask)) return;

    form.setValue(
      "spec.model.task",
      engineTasksForVersion.includes("text-generation")
        ? "text-generation"
        : engineTasksForVersion[0],
      derivedValueOptions(Boolean(form.getFieldState("spec.model.task").error)),
    );
  }, [engineSpec.engine, engineTasksForVersion, form]);

  // Set each key of obj as a separate form.setValue call, recursing into
  // nested plain objects. This ensures mounted FormField controllers get
  // notified, because useController uses useWatch with exact:true and
  // only reacts to setValue calls whose path exactly matches the field name.
  const setLeafValues = useCallback(
    (basePath: string, obj: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(obj)) {
        const path = `${basePath}.${key}` as Path<Endpoint>;
        // Clear an existing error with the applied value, but do not surface
        // new required errors merely because a catalog supplied the field.
        form.setValue(path, value as PathValue<Endpoint, typeof path>, {
          shouldValidate: Boolean(form.getFieldState(path).error),
        });
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          setLeafValues(path, value as Record<string, unknown>);
        }
      }
    },
    [form],
  );

  const applyModelValues = useCallback(
    (model: ModelSpec | null | undefined) => {
      if (!model) return;
      setLeafValues("spec.model", model as unknown as Record<string, unknown>);
    },
    [setLeafValues],
  );

  useEffect(() => {
    if (action !== "edit" || !queryResources) return;

    const queryResourcesKey = JSON.stringify(queryResources);
    if (syncedQueryResourcesKeyRef.current === queryResourcesKey) return;

    const resourcesForForm = normalizeEndpointResourcesForForm(queryResources);
    if (!resourcesForForm) return;
    syncedQueryResourcesKeyRef.current = queryResourcesKey;

    const currentResources = form.getValues("spec.resources") as
      | Record<string, unknown>
      | null
      | undefined;
    if (JSON.stringify(currentResources) === JSON.stringify(resourcesForForm)) {
      return;
    }

    form.setValue("spec.resources", resourcesForForm as ResourceSpec, {
      shouldDirty: false,
      shouldValidate: false,
    });
    setLeafValues(
      "spec.resources",
      resourcesForForm as unknown as Record<string, unknown>,
    );
  }, [action, form, queryResources, setLeafValues]);

  useEffect(() => {
    if (action !== "edit") return;

    const currentResources = (form.getValues("spec.resources") ??
      watchedResources) as Record<string, unknown> | null | undefined;
    const resourcesForForm =
      normalizeEndpointResourcesForForm(currentResources);
    if (!resourcesForForm) return;
    if (JSON.stringify(currentResources) === JSON.stringify(resourcesForForm)) {
      return;
    }

    form.setValue("spec.resources", resourcesForForm as ResourceSpec, {
      shouldDirty: false,
      shouldValidate: false,
    });
    setLeafValues(
      "spec.resources",
      resourcesForForm as unknown as Record<string, unknown>,
    );
  }, [action, form, watchedResources, setLeafValues]);

  // Apply a merged catalog spec (or defaults when null) to the form.
  const applyCatalogSpec = (catalogSpec: Record<string, unknown> | null) => {
    const merged = buildCatalogMergedSpec(catalogSpec);
    for (const [key, value] of Object.entries(merged)) {
      setLeafValues(`spec.${key}`, value);
    }
  };

  // Locate the currently selected catalog (or undefined).
  const selectedCatalog = useMemo<EndpointModelCatalogRef | undefined>(
    () =>
      modelCatalogs.query.data?.data.find(
        (catalog) => catalog.id.toString() === selectedModelCatalog,
      ),
    [modelCatalogs.query.data?.data, selectedModelCatalog],
  );

  // True when the selected catalog uses the Recipe extension.
  const isRecipeCatalog = useMemo(
    () => isRecipeShape(selectedCatalog?.spec ?? null),
    [selectedCatalog],
  );

  // Distinct feature group labels in first-seen order. The first *named* group
  // is treated as the "core" group and promoted into the main form grid (like
  // the deploy mockup's 上下文窗口 / 并发数 fields); the rest render in the
  // Features section below. All driven by the same selection state.
  const featureGroups = useMemo(() => {
    const gs: string[] = [];
    for (const f of selectedCatalog?.spec.features ?? []) {
      const g = f.group ?? "";
      if (!gs.includes(g)) gs.push(g);
    }
    return gs;
  }, [selectedCatalog]);
  const coreFeatureGroup = featureGroups[0] ?? "";
  const promoteCoreFeatures = Boolean(coreFeatureGroup);
  const bottomFeatureGroups = promoteCoreFeatures
    ? featureGroups.slice(1)
    : featureGroups;

  // Live composition for Recipe MCs — used for preview and for populating the
  // form fields on selection / when the user toggles features/variant.
  const composeResult = useMemo(() => {
    if (!selectedCatalog || !isRecipeCatalog) return null;
    return composeEndpointSpec(
      selectedCatalog.spec as RecipeInputSpec,
      selectedVariant,
      featureSelections,
    );
  }, [selectedCatalog, isRecipeCatalog, selectedVariant, featureSelections]);

  // Apply a composed Recipe spec onto the form. Composition happens entirely
  // client-side, so the endpoint is written as a plain, concrete spec (model /
  // engine / resources / variables / env) — no recipe refs are persisted; the
  // variant/feature selection lives only in this hook's local state.
  const applyComposedToForm = (composed: ComposedSpec) => {
    // Build a pseudo catalog spec containing only the kernel fields so we can
    // reuse buildCatalogMergedSpec's deep-merge over defaults.
    const pseudoCatalogSpec: Record<string, unknown> = {
      model: composed.model ?? undefined,
      engine: composed.engine ?? undefined,
      resources: composed.resources ?? undefined,
      variables: { engine_args: composed.engine_args ?? {} },
      env: composed.env ?? {},
    };
    const merged = buildCatalogMergedSpec(pseudoCatalogSpec);
    for (const key of COMPOSED_SPEC_FIELD_KEYS) {
      // A model edited through Resolved model is a deliberate user override.
      // Recomposition may refresh the fields the variant still owns, but it
      // must not replace the model while the override is active.
      if (key === "model" && resolvedModelCustomized) continue;
      const value = merged[key];
      if (value != null) setLeafValues(`spec.${key}`, value);
    }
  };

  // Keep the form in sync with composeResult itself, rather than re-applying
  // it only at the handful of call sites that change variant/features. That
  // covers those same triggers (composeResult depends on selectedVariant and
  // featureSelections) *and* the case those call sites missed: the selected
  // catalog's own data changing under it — e.g. its model repository gets
  // edited elsewhere and the catalog list refetches — which used to leave the
  // form showing stale fields until the user happened to touch the variant.
  // biome-ignore lint/correctness/useExhaustiveDependencies: applyComposedToForm is recreated every render and not itself a dependency of what it does — only composeResult's identity should trigger a re-apply.
  useEffect(() => {
    if (modelSourceMode === "catalog" && composeResult?.ok) {
      applyComposedToForm(composeResult.spec);
    }
  }, [composeResult, modelSourceMode]);

  // Handle model catalog selection with merge logic. Trivial MCs go through
  // the original `applyCatalogSpec` path; Recipe MCs go through the composer,
  // driven by the effect above once selectedVariant/featureSelections land.
  const handleModelCatalogSelect = (catalogId: string) => {
    setModelSourceMode("catalog");
    setResolvedModelEditing(false);
    setResolvedModelCustomized(false);
    setVariantResetNotice(null);
    setVariantResetSnapshot(null);
    setCatalogModelDraft(null);
    setSelectedModelCatalog(catalogId);

    if (!catalogId) {
      applyCatalogSpec(null);
      setSelectedVariant("");
      setFeatureSelections([]);
      return;
    }

    const catalog = modelCatalogs.query.data?.data.find(
      (c) => c.id.toString() === catalogId,
    );
    if (!catalog) return;

    if (isRecipeShape(catalog.spec)) {
      // Recipe path — initialize variant/features defaults; the effect above
      // composes and applies once these land.
      const variants = Object.keys(catalog.spec.variants ?? {});
      const initialVariant = variants.includes(DEFAULT_VARIANT)
        ? DEFAULT_VARIANT
        : (variants[0] ?? DEFAULT_VARIANT);
      const initialFeatures = defaultFeatureSelections(
        catalog.spec as RecipeInputSpec,
      );
      setSelectedVariant(initialVariant);
      setFeatureSelections(initialFeatures);
    } else {
      // Trivial path — current behavior, unchanged.
      applyCatalogSpec(catalog.spec as Record<string, unknown>);
      setSelectedVariant("");
      setFeatureSelections([]);
    }
  };

  // Deploy-from-catalog-card: the catalog list page links here with
  // `?model_catalog=<id>` to preselect that catalog (lightweight deploy entry —
  // no backend change, the create form just opens with the catalog chosen).
  // Read the id straight off the HashRouter URL (no refine router hook, so this
  // stays inert in unit tests that mount the hook without a router) and apply
  // once, after the catalog list has loaded and contains the id.
  const preselectAppliedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot guarded preselect; intentionally excludes handleModelCatalogSelect
  useEffect(() => {
    if (preselectAppliedRef.current || !preselectCatalogId) return;
    const list = modelCatalogs.query.data?.data;
    if (!list?.some((c) => c.id.toString() === preselectCatalogId)) return;
    preselectAppliedRef.current = true;
    handleModelCatalogSelect(preselectCatalogId);
  }, [preselectCatalogId, modelCatalogs.query.data]);

  // Deploy-from-registry-model: the model detail drawer links here with the
  // exact registry/model/revision. Wait until the registry listing confirms
  // that the target exists, then populate the same form fields a manual pick
  // would populate and fetch the checkpoint information once.
  const registryModelPreselectAppliedRef = useRef(false);
  useEffect(() => {
    if (
      registryModelPreselectAppliedRef.current ||
      !preselectRegistryModel ||
      !modelRegistryNames?.includes(preselectRegistryModel.registry)
    ) {
      return;
    }

    registryModelPreselectAppliedRef.current = true;
    form.setValue("spec.model.registry", preselectRegistryModel.registry);
    form.setValue("spec.model.name", preselectRegistryModel.model);
    if (preselectRegistryModel.version) {
      form.setValue("spec.model.version", preselectRegistryModel.version);
    }
    form.setValue("spec.model.info", null);
    setModelSourceMode("manual");
    setResolvedModelEditing(true);
    setResolvedModelCustomized(false);
    setVariantResetNotice(null);
    setVariantResetSnapshot(null);
    setPickedModelRef({
      workspace,
      registry: preselectRegistryModel.registry,
      model: preselectRegistryModel.model,
      version: preselectRegistryModel.version,
    });
  }, [form, modelRegistryNames, preselectRegistryModel, workspace]);

  // When user changes variant or features, the effect above re-composes and
  // re-applies from the new selection.
  const handleVariantChange = (v: string) => {
    if (v === selectedVariant) return;
    const previousVariantModel = modelIdentity(
      composeResult?.ok ? composeResult.spec.model : null,
    );
    if (resolvedModelCustomized) {
      const resetCount = Math.max(
        1,
        countModelChanges(currentModelValues, previousVariantModel),
      );
      setVariantResetSnapshot({
        notice: {
          variant: v,
          resetCount,
        },
        variant: selectedVariant,
        model: currentModelValues,
        editing: resolvedModelEditing,
      });
      setVariantResetNotice({
        variant: v,
        resetCount,
      });
    } else {
      setVariantResetNotice(null);
      setVariantResetSnapshot(null);
    }
    setResolvedModelCustomized(false);
    setResolvedModelEditing(false);
    setSelectedVariant(v);
  };

  const handleFeaturesChange = (next: FeatureSelection[]) => {
    setFeatureSelections(next);
  };

  const clusterGpuResourcesPanel = (
    <EndpointClusterGpuResourcesPanel
      resourceInfo={schedulingResourceInfo}
      schedulingNodeResources={reusableNodeResources}
      currentCluster={currentCluster}
      nodeCount={selectedClusterNodeCount}
      selectedAccelerator={selectedAccelerator}
      virtualizationEnabled={isSelectedClusterVgpuEnabled}
      request={{
        allocationMode: isFractionalGpuAllocationMode
          ? "fractional"
          : effectiveGpuAllocationMode,
        gpuPerReplica: gpuUsage,
        cpuPerReplica: normalizedResources?.cpu,
        memoryPerReplica: normalizedResources?.memory,
        requestedFullGpuCards,
        fullGpuCardCapacity,
        fullGpuCapacityExceeded: isFullGpuCapacityExceededWithPlacement,
        requestedVirtualCards,
        totalVirtualCardCapacity,
        requestedVgpuMemoryMiB,
        availableVgpuMemoryMiB,
        requestedVgpuCoreUnits,
        availableVgpuCoreUnits,
        memoryMiBPerCard: effectiveVgpuMemoryMiB,
        coreUnitsPerCard: vgpuCoreUnitsPerCard,
        vgpuCapacityExceeded: isVgpuCapacityExceededWithPlacement,
      }}
      t={t}
    />
  );

  const handleModelSourceModeChange = (next: ModelSourceMode) => {
    if (next === modelSourceMode) return;

    if (next === "manual") {
      setCatalogModelDraft({
        model: currentModelValues,
        editing: resolvedModelEditing,
        customized: resolvedModelCustomized,
      });
      const draft = manualModelDraft ?? {
        model: currentModelValues,
        editing: true,
        customized: false,
      };
      setModelSourceMode("manual");
      setResolvedModelEditing(draft.editing);
      setResolvedModelCustomized(draft.customized);
      applyModelValues(draft.model);
    } else {
      setManualModelDraft({
        model: currentModelValues,
        editing: resolvedModelEditing,
        customized: resolvedModelCustomized,
      });
      const draft = catalogModelDraft ?? {
        model: modelIdentity(
          composeResult?.ok ? composeResult.spec.model : null,
        ),
        editing: false,
        customized: false,
      };
      setModelSourceMode("catalog");
      setResolvedModelEditing(draft.editing);
      setResolvedModelCustomized(draft.customized);
      if (selectedCatalog) applyModelValues(draft.model);
    }

    setVariantResetNotice(null);
    setVariantResetSnapshot(null);
  };

  const markResolvedModelCustomized = () => {
    setResolvedModelCustomized(true);
    setVariantResetNotice(null);
    setVariantResetSnapshot(null);
  };

  const handleResolvedModelRegistryChange = (value: string) => {
    form.setValue("spec.model.registry", value, userSetValueOptions);
    form.setValue("spec.model.name", "", userSetValueOptions);
    form.setValue("spec.model.version", "", userSetValueOptions);
    form.setValue("spec.model.file", "", userSetValueOptions);
    form.setValue("spec.model.info", null);
    setModelSearch("");
    markResolvedModelCustomized();
  };

  const handleResolvedModelNameChange = (value: string) => {
    form.setValue("spec.model.name", value, userSetValueOptions);
    form.setValue("spec.model.version", "", userSetValueOptions);
    form.setValue("spec.model.file", "", userSetValueOptions);
    form.setValue("spec.model.info", null);
    setPickedModelRef(
      workspace && currentRegistry && value
        ? {
            workspace,
            registry: currentRegistry,
            model: value,
          }
        : null,
    );
    markResolvedModelCustomized();
  };

  const resetResolvedModel = () => {
    const composedModel = composeResult?.ok ? composeResult.spec.model : null;
    setResolvedModelCustomized(false);
    setResolvedModelEditing(false);
    setVariantResetNotice(null);
    setVariantResetSnapshot(null);
    applyModelValues(composedModel);
  };

  const undoVariantReset = () => {
    if (!variantResetSnapshot) return;
    setSelectedVariant(variantResetSnapshot.variant);
    setResolvedModelCustomized(true);
    setResolvedModelEditing(variantResetSnapshot.editing);
    setVariantResetNotice(null);
    setVariantResetSnapshot(null);
    applyModelValues(variantResetSnapshot.model);
  };

  // Active variant + its display metadata, used for the estimate summary.
  const activeVariant =
    modelSourceMode === "catalog"
      ? (selectedCatalog?.spec.variants?.[selectedVariant] ??
        selectedCatalog?.spec.variants?.default)
      : null;
  const activeVariantVram = activeVariant?.vram_minimum_gb ?? null;
  const activeModelInfo = activeVariant?.model?.info ?? null;

  // What the KV cache estimate is computed from. There is no second read for
  // it: picking a model already fetches the version detail above and lands its
  // `info` on the form, and a catalog variant carries that metadata with it, so
  // both routes are already answered by the time the panel needs them. The read
  // state comes from that same query, which is what separates "still reading"
  // and "the registry refused" from "the checkpoint omits this field".
  const currentModelInfo = form.watch("spec.model.info") ?? null;
  const checkpointWeightsGb = estimateCheckpointWeightsGb(
    currentModelInfo ?? activeModelInfo,
  );
  const weightsFromModelSize =
    directModelSelection && modelSizeRef
      ? estimateModelWeightsGb(modelSizeVersion.model?.size)
      : null;

  // What this deployment will actually be created with, which is what the KV
  // cache estimate should start from. These are the composed engine args — a
  // catalog recipe writes them here when a variant or a feature is applied, and
  // the raw form writes them here when a user edits them directly — so the
  // panel sees whatever will be deployed without knowing which route produced
  // it. A path that states neither flag reads as nothing and the panel falls
  // back to the checkpoint.
  const engineCacheArgs = readEngineCacheArgs(
    form.watch("spec.engine.engine"),
    form.watch("spec.variables.engine_args"),
  );
  // A recipe that exposes the context window as a feature gives the user one
  // place to set it; the estimate reads that rather than offering a second
  // field holding the same number. Read from the features rather than from
  // which group they were put in, so it holds however a catalog is organised.
  const engineCacheArgControls = findEngineCacheArgControls(
    form.watch("spec.engine.engine"),
    isRecipeCatalog ? selectedCatalog?.spec.features : null,
  );
  const modelInfoRead = resolveModelInfoRead({
    selected: Boolean(
      currentModelInfo ||
        activeModelInfo ||
        (currentRegistry && currentModelName),
    ),
    // The form's copy first, because it is the model this endpoint will be
    // created with. Applying a catalog writes the variant's metadata here, and
    // picking a model replaces it with what that checkpoint reports — so this
    // follows the selection either way.
    //
    // The variant's own copy cannot stand in front of it: a catalog states a
    // model's *display* metadata (parameter count, quantization) and not the
    // shape the cache arithmetic needs, so preferring it made a model picked
    // from a catalog report the checkpoint as silent about its layers, KV heads
    // and head dim — while the same model picked without a catalog estimated
    // fine. It stays as the fallback for a variant whose metadata never reached
    // the form.
    info: currentModelInfo ?? activeModelInfo,
    isLoading: pickedModelVersion.isLoading,
    error: pickedModelVersion.error,
  });

  // GPU products this recipe MC declares as validated (annotation
  // `recipe.vllm.ai/hardware-verified`, e.g. "H200,H100,L40S"); empty for
  // non-recipe / un-annotated catalogs.
  const verifiedProducts = useMemo(() => {
    const raw =
      modelSourceMode === "catalog"
        ? (selectedCatalog?.metadata.annotations?.[
            "recipe.vllm.ai/hardware-verified"
          ] ?? "")
        : "";
    return new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }, [modelSourceMode, selectedCatalog]);
  const engineAcceleratorTypes = useMemo(
    () => Object.keys(engineVersion?.images ?? {}),
    [engineVersion],
  );
  engineAcceleratorTypesRef.current = engineAcceleratorTypes;
  // A recipe's validated list orders and labels the accelerators; it never
  // removes any. Sort is stable, so the cluster's own order survives within
  // each group.
  const displayedAcceleratorOptions = useMemo(() => {
    const marked = acceleratorOptions.map((option) => {
      const total = Math.max(0, Number(option.total || 0));
      const free = Math.min(total, Math.max(0, Number(option.available || 0)));

      return {
        ...option,
        capacityDescription: t("endpoints.options.acceleratorCapacity", {
          defaultValue: "{{free}} free · {{total}} total",
          free: formatCapacityValue(free),
          total: formatCapacityValue(total),
        }),
        engineCompatible:
          engineAcceleratorTypes.length === 0 ||
          engineAcceleratorTypes.includes(option.type),
        verified:
          verifiedProducts.size > 0 &&
          matchesAcceleratorName(option.product, verifiedProducts),
      };
    });

    return marked.some((option) => option.verified)
      ? [...marked].sort((a, b) => Number(b.verified) - Number(a.verified))
      : marked;
  }, [acceleratorOptions, engineAcceleratorTypes, t, verifiedProducts]);

  // A catalog may carry reference hardware that does not exist on the cluster
  // the user then chooses. Reconcile the dependent field as soon as the
  // cluster's real accelerator inventory arrives: one option can be selected
  // for the user; multiple options must be an explicit choice.
  useEffect(() => {
    if (
      !currentCluster ||
      !selectedCluster?.status?.resource_info ||
      acceleratorOptions.length === 0
    ) {
      return;
    }

    const current = form.getValues("spec.resources.accelerator");
    const compatibleOptions = acceleratorOptions.filter(
      (option) =>
        engineAcceleratorTypes.length === 0 ||
        engineAcceleratorTypes.includes(option.type),
    );
    const currentIsAvailable = Boolean(
      current?.type &&
        current.product &&
        compatibleOptions.some(
          (option) =>
            option.type === current.type && option.product === current.product,
        ),
    );
    if (currentIsAvailable) return;
    if (!current && compatibleOptions.length !== 1) return;

    const option = compatibleOptions.length === 1 ? compatibleOptions[0] : null;
    const currentVirtualization = current?.virtualization;
    form.setValue(
      "spec.resources.accelerator",
      option
        ? {
            type: option.type,
            product: option.product,
            ...(isSelectedClusterVgpuEnabled
              ? { virtualization: currentVirtualization || {} }
              : {}),
          }
        : null,
      derivedValueOptions(
        Boolean(form.getFieldState("spec.resources.accelerator").error),
      ),
    );
  }, [
    acceleratorOptions,
    engineAcceleratorTypes,
    currentCluster,
    form,
    isSelectedClusterVgpuEnabled,
    selectedCluster?.status?.resource_info,
  ]);

  // The recipe names validated GPUs and this cluster has none of them. Said
  // out loud next to the picker, because every option below is then untested
  // for this recipe. A GPU-less cluster (or one whose resource info has not
  // loaded) is not that case and must not claim to be.
  const noVerifiedAcceleratorAvailable =
    verifiedProducts.size > 0 &&
    Boolean(currentCluster) &&
    acceleratorOptions.length > 0 &&
    !displayedAcceleratorOptions.some((option) => option.verified);

  const formWithTransformedOnFinish = {
    ...form,
    refineCore: {
      ...form.refineCore,
      onFinish: async (
        values: Parameters<typeof form.refineCore.onFinish>[0],
      ) => {
        // A recipe selection that doesn't compose must not be submitted: the
        // form's legacy spec fields still hold the last successful compose (or
        // empty defaults), so submitting would deploy a spec that contradicts
        // the visible variant/feature selection. Block and surface the error.
        if (composeResult && !composeResult.ok) {
          toast.error(
            t("endpoints.recipe.composeBlocked", {
              error: composeResult.error,
            }),
          );
          return;
        }
        const transformedValues =
          typeof structuredClone === "function"
            ? structuredClone(values)
            : JSON.parse(JSON.stringify(values));
        transformEndpointValues((transformedValues as Endpoint).spec);

        // A catalog written for an engine that needs no `spec.model` may still
        // carry one — the merge copies it in, and the form never shows it, so
        // the user has no way to correct or even see it. Submitting a registry
        // and model this workspace may not have names a checkpoint nobody
        // fetches. Only `task` survives, which the engine itself sets and the
        // gateway routes on.
        if (hidesModelFields) {
          const spec = (transformedValues as Endpoint).spec as unknown as {
            model?: Record<string, unknown> | null;
          };
          if (spec.model) {
            spec.model = {
              ...defaultEndpointSpec.model,
              task: spec.model.task ?? "",
            };
          }
        }

        // Record what this was deployed from, while the answer is still in
        // hand: the spec about to be submitted is the composed result, and
        // nothing in it says which catalog, variant or features produced it.
        // Create only — an edit is not a new deployment, and rewriting the
        // record would claim the endpoint came from wherever it happens to
        // point today.
        if (!isEdit && selectedCatalog && modelSourceMode === "catalog") {
          const endpoint = transformedValues as Endpoint;
          endpoint.metadata = {
            ...endpoint.metadata,
            annotations: {
              ...endpoint.metadata?.annotations,
              ...buildCatalogOriginAnnotations({
                catalog: selectedCatalog.metadata.name,
                // Composition reads "" as the default profile, so the record
                // names it rather than leaving the field empty.
                variant: isRecipeCatalog
                  ? selectedVariant || DEFAULT_VARIANT
                  : undefined,
                features: isRecipeCatalog ? featureSelections : undefined,
              }),
            },
          };
        }

        return form.refineCore.onFinish(transformedValues);
      },
    },
  };

  // A catalog can expose the Flex workload image as a recipe feature, where the
  // default is routinely a placeholder the user must replace. The addon decides
  // for itself whether a given feature is that one.
  const workloadImageAddon = (
    feature: RecipeFeature,
    { onChange }: { value: string; onChange: (value: string) => void },
  ) => (
    <WorkloadImageFeatureAddon
      engine={engineSpec?.engine}
      feature={feature}
      workspace={workspace}
      registry={selectedCluster?.spec?.image_registry}
      onChange={onChange}
    />
  );

  const modelVersionFields = !hidesModelFields ? (
    <ModelOptionalFields
      control={form.control}
      values={currentModelValues}
      className="col-span-4"
    />
  ) : null;

  const engineFields = (
    <FormCardGrid
      title={t("endpoints.sections.engineSettings")}
      variant={sectionVariant}
    >
      <FormFieldGroup
        {...form}
        name="spec.engine.engine"
        label={t("common.fields.engine")}
        required
      >
        <FormCombobox
          placeholder={t("endpoints.placeholders.selectEngine")}
          disabled={engines.query.isLoading}
          options={engineNames.map((v) => ({
            label: v,
            value: v,
          }))}
          onChange={(value) => {
            const newest = newestVersion(engineVersions[String(value)] ?? []);
            const tasks = engineTasks[String(value)] ?? [];
            form.setValue(
              "spec.engine",
              {
                engine: value,
                version: newest?.version ?? "",
              },
              userSetValueOptions,
            );
            form.setValue(
              "spec.model.task",
              tasks.includes("text-generation")
                ? "text-generation"
                : (tasks[0] ?? ""),
              userSetValueOptions,
            );
            form.trigger("spec.engine.engine");
          }}
        />
      </FormFieldGroup>
      <FormFieldGroup
        {...form}
        name="spec.engine.version"
        label={t("endpoints.fields.engineVersion")}
        required
      >
        <FormCombobox
          placeholder={t("endpoints.placeholders.selectVersion")}
          disabled={!form.getValues().spec.engine.engine}
          options={sortVersionsNewestFirst(
            engineVersions[form.getValues().spec.engine.engine] || [],
          ).map(({ version: v }) => ({
            label: v,
            value: v,
          }))}
        />
      </FormFieldGroup>
      {!hidesModelFields && (
        <FormFieldGroup
          {...form}
          name="spec.model.task"
          label={t("endpoints.fields.taskType")}
          required
        >
          <FormCombobox
            placeholder={t("endpoints.placeholders.selectTaskType")}
            disabled={!form.getValues().spec.engine.engine}
            options={engineTasksForVersion.map((v) => ({
              label:
                t(`models.tasks.${v}`) === `models.tasks.${v}`
                  ? formatTaskName(v)
                  : t(`models.tasks.${v}`),
              value: v,
            }))}
          />
        </FormFieldGroup>
      )}
    </FormCardGrid>
  );

  const weightsFromCatalog =
    selectedCatalog && modelSourceMode === "catalog" ? activeVariantVram : null;
  const weightsFromCheckpoint =
    selectedCatalog && modelSourceMode === "catalog"
      ? checkpointWeightsGb
      : null;
  const perReplicaWeights =
    weightsFromCatalog ?? weightsFromModelSize ?? weightsFromCheckpoint;
  const declaredWeights =
    perReplicaWeights == null
      ? null
      : {
          perReplicaGb: perReplicaWeights,
          source:
            weightsFromCatalog != null
              ? ("catalog" as const)
              : weightsFromModelSize != null
                ? ("model-size" as const)
                : ("checkpoint" as const),
          replicas: replicaCount,
          // Only accelerator data that came from the selected cluster. The
          // composed variant also writes its reference accelerator into the form;
          // checking that is recipe-vs-recipe math with nothing of the
          // environment in it.
          accelerator: {
            product: selectedAcceleratorOption?.product,
            perGpuGb:
              selectedMemoryTotalMiB != null
                ? selectedMemoryTotalMiB / 1024
                : undefined,
            gpuCount: form.watch("spec.resources.gpu"),
          },
        };
  // An engine serving a model baked into its own image has no checkpoint to
  // estimate from.
  const kvCacheEstimate = hidesModelFields
    ? null
    : {
        read: modelInfoRead,
        engineArgs: engineCacheArgs,
        controls: engineCacheArgControls,
        modelKey: `${currentRegistry ?? ""}:${currentModelName ?? ""}:${
          form.watch("spec.model.version") ?? ""
        }`,
      };
  // The declared figure is weights alone; what a replica needs in VRAM also
  // includes the KV cache, which the estimate panel in the deployment summary
  // computes from the context and concurrency this deployment will run with.
  // The total is held here rather than in the panel so the review step and the
  // unverified-accelerator notice check the same figure the summary shows, and
  // keep it while the summary tab is closed. It is dropped when the model
  // changes: the previous model's cache says nothing about the next one.
  const [kvCacheGb, setKvCacheGb] = useState<number | null>(null);
  const kvCacheModelKey = kvCacheEstimate?.modelKey ?? null;
  const [kvCacheGbModelKey, setKvCacheGbModelKey] = useState(kvCacheModelKey);
  if (kvCacheGbModelKey !== kvCacheModelKey) {
    setKvCacheGbModelKey(kvCacheModelKey);
    setKvCacheGb(null);
  }
  const currentKvCacheGb = kvCacheEstimate ? kvCacheGb : null;
  const handleKvCacheStateChange = useCallback(
    (state: KVCacheEstimateState) =>
      setKvCacheGb(state.kind === "ready" ? state.totalGb : null),
    [],
  );
  const requiredVramGb = perReplicaRequiredGb(
    perReplicaWeights,
    currentKvCacheGb,
  );
  const wizardEstimateFields = (
    <EndpointDeploymentSummary
      values={form.watch() as unknown as Endpoint}
      declared={declaredWeights}
      kvCache={kvCacheEstimate}
      kvCacheGb={currentKvCacheGb}
      onKvCacheStateChange={handleKvCacheStateChange}
    />
  );
  const reviewCatalogOrigin = isEdit
    ? readCatalogOrigin(queryEndpoint?.metadata?.annotations)
    : selectedCatalog && modelSourceMode === "catalog"
      ? {
          catalog: selectedCatalog.metadata.name,
          ...(isRecipeCatalog
            ? { variant: selectedVariant || DEFAULT_VARIANT }
            : {}),
          features: isRecipeCatalog ? featureSelections : [],
          featuresUnreadable: false,
        }
      : null;
  const selectedProductResources =
    selectedAccelerator?.type && selectedAccelerator.product
      ? schedulingResourceInfo?.allocatable?.accelerator_groups?.[
          selectedAccelerator.type
        ]?.products?.[selectedAccelerator.product]
      : undefined;
  const selectedVgpuMemoryTotalMiB = Number(
    selectedProductResources?.virtualization?.memory_mib,
  );
  const selectedVgpuCoreTotal = Number(
    selectedProductResources?.virtualization?.core_units,
  );
  const reviewCapacity: EndpointReviewCapacityMetric[] | null =
    hasClusterCapacityEvidence
      ? [
          {
            key: "cpu",
            requested: (normalizedResources?.cpu || 0) * replicaCount,
            available: maxAvailable.cpu.available,
            total: maxAvailable.cpu.total,
          },
          {
            key: "memory",
            requested: (normalizedResources?.memory || 0) * replicaCount,
            available: maxAvailable.memory.available,
            total: maxAvailable.memory.total,
          },
          ...(selectedAccelerator?.type && selectedAccelerator.product
            ? [
                {
                  key: "cards" as const,
                  requested: isVgpuAllocationMode
                    ? requestedVirtualCards
                    : requestedFullGpuCards,
                  available: isVgpuAllocationMode
                    ? totalVirtualCardCapacity
                    : fullGpuCardCapacity,
                  total: maxFullGpuCards,
                },
              ]
            : []),
          ...(isVgpuAllocationMode
            ? [
                {
                  key: "vram" as const,
                  requested: requestedVgpuMemoryMiB / 1024,
                  available: availableVgpuMemoryMiB / 1024,
                  total:
                    Number.isFinite(selectedVgpuMemoryTotalMiB) &&
                    selectedVgpuMemoryTotalMiB > 0
                      ? selectedVgpuMemoryTotalMiB / 1024
                      : null,
                },
                {
                  key: "core" as const,
                  requested: requestedVgpuCoreUnits,
                  available: availableVgpuCoreUnits,
                  total:
                    Number.isFinite(selectedVgpuCoreTotal) &&
                    selectedVgpuCoreTotal > 0
                      ? selectedVgpuCoreTotal
                      : null,
                },
              ]
            : []),
        ]
      : null;
  const reviewContext: EndpointReviewContext = {
    catalogOrigin: reviewCatalogOrigin,
    modelDelivery: selectedModelDelivery,
    noVerifiedAccelerator: noVerifiedAcceleratorAvailable,
    requiredVramGb,
    nodeCount: selectedClusterNodeCount,
    clusterCapacity: reviewCapacity,
    clusterCapacityUnavailable: Boolean(
      currentCluster && !hasClusterCapacityEvidence,
    ),
  };
  const currentDeploymentValues = form.watch() as unknown as Endpoint;
  const hasDeploymentPreview = Boolean(
    currentDeploymentValues.spec.model?.name ||
      currentDeploymentValues.spec.engine?.engine ||
      currentDeploymentValues.spec.cluster ||
      currentDeploymentValues.spec.resources,
  );
  const configurationSummaryFields =
    hasDeploymentPreview || (composeResult && !composeResult.ok) ? (
      <EndpointConfigurationSummary
        values={currentDeploymentValues}
        reviewContext={reviewContext}
        composeError={
          composeResult && !composeResult.ok ? composeResult.error : null
        }
        modelRequired={!hidesModelFields}
      />
    ) : null;

  const resolvedModelSourceLabel =
    modelSourceMode === "manual"
      ? t("endpoints.resolvedModel.direct")
      : isRecipeCatalog
        ? selectedVariant || DEFAULT_VARIANT
        : t("endpoints.modelSource.catalog");
  const resolvedModelTitle =
    modelSourceMode === "manual"
      ? t("endpoints.resolvedModel.selectedTitle")
      : t("endpoints.resolvedModel.title");
  const catalogProfileModelValues = modelIdentity(
    isRecipeCatalog && composeResult?.ok
      ? composeResult.spec.model
      : selectedCatalog?.spec.model,
  );
  const resolvedModelOverridden =
    modelSourceMode === "catalog" &&
    Boolean(selectedCatalog) &&
    countModelChanges(currentModelValues, catalogProfileModelValues) > 0;
  const resolvedModelEditor = (
    <EndpointResolvedModelEditor
      direct={modelSourceMode === "manual"}
      title={resolvedModelTitle}
      control={form.control}
      values={currentModelValues}
      sourceLabel={resolvedModelSourceLabel}
      editing={resolvedModelEditing}
      customized={resolvedModelOverridden}
      registryOptions={modelRegistryOptions}
      registryLoading={modelRegistries.query.isLoading}
      modelOptions={modelsData.models.map((model) => ({
        label: registryModelLabel(model),
        value: model.name,
      }))}
      modelLoading={
        modelsData.isFetching ? (
          <CommandLoading className="px-2 py-1.5 text-muted-foreground">
            {t("endpoints.messages.fetching")}
          </CommandLoading>
        ) : null
      }
      modelDisabled={!currentRegistry}
      allowReset={modelSourceMode === "catalog" && Boolean(selectedCatalog)}
      resetNotice={variantResetNotice}
      onToggleEditing={() => setResolvedModelEditing((editing) => !editing)}
      onReset={resetResolvedModel}
      onUndo={undoVariantReset}
      onRegistryChange={handleResolvedModelRegistryChange}
      onModelChange={handleResolvedModelNameChange}
      onModelSearchChange={setModelSearch}
      onVersionInput={markResolvedModelCustomized}
      onFileInput={markResolvedModelCustomized}
    />
  );

  const recipeVariantFields =
    !isEdit && isRecipeCatalog && selectedCatalog ? (
      <>
        {(selectedCatalog.metadata.annotations?.[
          "recipe.vllm.ai/hardware-verified"
        ] ??
          "") && (
          <div className="col-span-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {t("endpoints.recipe.verifiedOn", "Verified on:")}
            </span>
            {Array.from(verifiedProducts).map((hardware) => (
              <Badge
                key={hardware}
                variant="outline"
                className="border-green-600/40 text-green-700 dark:text-green-400"
              >
                ✓ {hardware}
              </Badge>
            ))}
          </div>
        )}
        <div className="col-span-4 space-y-2">
          <div className="text-sm font-medium">
            {t("endpoints.recipe.variant", "Variant")}
          </div>
          <VariantPicker
            variants={selectedCatalog.spec.variants ?? {}}
            value={selectedVariant}
            onChange={handleVariantChange}
          />
        </div>
      </>
    ) : null;

  const recipeFeatureFields =
    !isEdit && isRecipeCatalog && selectedCatalog ? (
      <>
        {promoteCoreFeatures && (
          <div className="col-span-4">
            <FeaturePicker
              features={selectedCatalog.spec.features ?? []}
              value={featureSelections}
              onChange={handleFeaturesChange}
              renderGroups={[coreFeatureGroup]}
              layout="grid"
              inputAddon={workloadImageAddon}
            />
          </div>
        )}
        {selectedCatalog.spec.features &&
          selectedCatalog.spec.features.length > 0 &&
          bottomFeatureGroups.length > 0 && (
            <div className="col-span-4 space-y-2">
              <div className="text-sm font-medium">
                {t("endpoints.recipe.features", "Features")}
              </div>
              <FeaturePicker
                features={selectedCatalog.spec.features ?? []}
                value={featureSelections}
                onChange={handleFeaturesChange}
                renderGroups={bottomFeatureGroups}
                inputAddon={workloadImageAddon}
              />
            </div>
          )}
      </>
    ) : null;

  const resolvedModelRuntimeHint =
    selectedModelDelivery === "at-deploy-time" ? (
      <Alert
        className="col-span-4"
        data-testid="endpoint-runtime-download-hint"
      >
        <AlertDescription>
          {t("endpoints.messages.runtimeDownloadHint")}
        </AlertDescription>
      </Alert>
    ) : selectedModelDelivery === "unknown" ? (
      <Alert
        variant="warning"
        className="col-span-4"
        data-testid="endpoint-runtime-download-unknown"
      >
        <AlertDescription>
          {t("endpoints.messages.runtimeDownloadUnknown")}
        </AlertDescription>
      </Alert>
    ) : null;

  const wizardProfileFields = (
    <FormCardGrid
      title={t("endpoints.sections.modelAndProfile")}
      variant={sectionVariant}
    >
      {!hidesModelFields && (
        <div className="col-span-4">
          <div className="mb-2 text-sm font-medium text-[var(--nt-text-neutral-secondary)]">
            {t("endpoints.modelSource.label")}
          </div>
          <SegmentedControl<ModelSourceMode>
            ariaLabel={t("endpoints.modelSource.label")}
            value={modelSourceMode}
            onValueChange={handleModelSourceModeChange}
            items={[
              {
                value: "catalog",
                label: t("endpoints.modelSource.catalog"),
              },
              {
                value: "manual",
                label: t("endpoints.modelSource.manual"),
              },
            ]}
          />
        </div>
      )}
      {!isEdit && isRecipeCatalog && selectedCatalog && (
        <p className="col-span-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
          {t("endpoints.simplified.autoConfigured")}
        </p>
      )}

      <div
        data-testid="model-catalog-row"
        className={cn(
          "col-span-4 grid grid-cols-1 sm:grid-cols-4",
          FORM_GRID_GAP_CLASS,
        )}
      >
        {!hidesModelFields && modelSourceMode === "catalog" && (
          <FormFieldGroup
            {...form}
            name="-model-catalog"
            label={t("endpoints.fields.modelCatalog")}
            className="sm:col-span-3"
          >
            <FormCombobox
              placeholder={t("endpoints.placeholders.selectModelCatalog")}
              disabled={modelCatalogs.query.isLoading}
              options={(modelCatalogs.query.data?.data || []).map(
                (catalog) => ({
                  label: catalog.metadata.name,
                  value: catalog.id.toString(),
                }),
              )}
              value={selectedModelCatalog}
              onChange={(value) => handleModelCatalogSelect(value as string)}
            />
          </FormFieldGroup>
        )}
        <FormFieldGroup
          {...form}
          name="spec.replicas.num"
          label={t("endpoints.fields.replicas")}
          className="sm:col-span-1"
          required
        >
          <Input type="number" min={1} />
        </FormFieldGroup>
      </div>

      {!hidesModelFields &&
        modelSourceMode === "catalog" &&
        !selectedCatalog && (
          <EmptyState variant="inline" className="col-span-4 text-left">
            <div className="font-medium">
              {t("endpoints.modelSource.emptyTitle")}
            </div>
            <div className="mt-1">
              {t("endpoints.modelSource.emptyDescription")}
            </div>
          </EmptyState>
        )}

      {modelSourceMode === "catalog" && recipeVariantFields}

      {!hidesModelFields &&
        (modelSourceMode === "manual" || selectedCatalog) && (
          <>
            <div className="col-span-4">{resolvedModelEditor}</div>
            {resolvedModelRuntimeHint}
          </>
        )}

      {modelSourceMode === "catalog" && recipeFeatureFields}
    </FormCardGrid>
  );

  const gpuCapacityMessages: string[] = [];
  if (
    currentCluster &&
    hasClusterCapacityEvidence &&
    selectedAccelerator?.type &&
    selectedAccelerator.product
  ) {
    if (isVgpuAllocationMode && isVgpuCapacityExceededWithPlacement) {
      gpuCapacityMessages.push(
        hasNoMatchingAccelerator
          ? t("endpoints.messages.noMatchingAccelerator", {
              product: selectedAccelerator.product ?? EMPTY_VALUE,
            })
          : t("endpoints.messages.vgpuResourcesInsufficient"),
      );
      if (hasVgpuMemoryCapacityExceeded) {
        gpuCapacityMessages.push(
          t("endpoints.messages.vgpuMemoryResourcesInsufficient"),
        );
      }
      if (hasVgpuCoreCapacityExceeded) {
        gpuCapacityMessages.push(
          t("endpoints.messages.vgpuCoreResourcesInsufficient"),
        );
      }
      if (hasNoNodeForVgpuReplica) {
        gpuCapacityMessages.push(
          t("endpoints.messages.noNodeCanScheduleVgpuRequest"),
        );
      }
      if (hasPartialGpuReplicaPlacement) {
        gpuCapacityMessages.push(
          t("endpoints.messages.partialGpuReplicaPlacement", {
            available: placementCapacity?.maxGpuPlaceableReplicas ?? 0,
            requested: replicaCount,
          }),
        );
      }
    } else if (
      !isVgpuAllocationMode &&
      isFullGpuCapacityExceededWithPlacement
    ) {
      if (hasNoMatchingAccelerator) {
        gpuCapacityMessages.push(
          t("endpoints.messages.noMatchingAccelerator", {
            product: selectedAccelerator.product ?? EMPTY_VALUE,
          }),
        );
      } else if (hasNoNodeForFullGpuReplica) {
        gpuCapacityMessages.push(
          t("endpoints.messages.noNodeCanScheduleFullGpuRequest", {
            count: placementCapacity?.requestedCardsPerReplica,
          }),
        );
      } else if (hasNoNodeForFractionalGpuReplica) {
        gpuCapacityMessages.push(
          t("endpoints.messages.noNodeCanScheduleFractionalGpuRequest"),
        );
      } else if (!hasFullGpuAggregateCardCapacityExceeded) {
        gpuCapacityMessages.push(
          t(
            isFractionalGpuAllocationMode
              ? "endpoints.messages.fractionalGpuResourcesInsufficient"
              : "endpoints.messages.fullGpuResourcesInsufficient",
          ),
        );
      }
      if (hasFullGpuAggregateCardCapacityExceeded) {
        gpuCapacityMessages.push(
          t("endpoints.messages.fullGpuCardCapacityInsufficient", {
            available: placementCapacity?.satisfyingDeviceCount ?? 0,
            requested: requestedFullGpuCards,
          }),
        );
      }
      if (hasPartialGpuReplicaPlacement) {
        gpuCapacityMessages.push(
          t("endpoints.messages.partialGpuReplicaPlacement", {
            available: placementCapacity?.maxGpuPlaceableReplicas ?? 0,
            requested: replicaCount,
          }),
        );
      }
    }
    if (hasCombinedNodePlacementCapacityExceeded) {
      gpuCapacityMessages.push(
        t("endpoints.messages.noNodeCanScheduleCombinedResourceRequest"),
      );
    }
  }
  const gpuCapacityMessageList =
    gpuCapacityMessages.length > 0 ? (
      <div
        data-testid="endpoint-gpu-capacity-messages"
        className="space-y-1 text-xs leading-4 text-destructive"
      >
        {gpuCapacityMessages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    ) : null;

  return {
    form: formWithTransformedOnFinish,
    editQuery: form.refineCore.query,
    currentWorkspace,
    // Block deploy while any requested resource exceeds cluster capacity; the
    // page forwards this straight to <ResourceForm submitBlocked>.
    submitBlocked: isResourceCapacityExceeded,
    metadataFields: (
      <FormCardGrid
        title={t("common.sections.basicInformation")}
        variant={sectionVariant}
      >
        <FormFieldGroup
          {...form}
          name="metadata.name"
          label={t("common.fields.name")}
          required
        >
          <Input
            placeholder={t("endpoints.placeholders.endpointName")}
            disabled={isEdit}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="metadata.workspace"
          label={t("common.fields.workspace")}
          required
        >
          {/*
            Validation is handled in the custom resolver above;
            rules are intentionally omitted here.
          */}
          <WorkspaceField disabled={isEdit} />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    wizardProfileFields,
    // The edit step's model section: what the endpoint was deployed from,
    // replicas, and the model it serves. Creating uses wizardProfileFields.
    templateFields: (
      <>
        <FormCardGrid
          title={t("endpoints.sections.modelAndProfile")}
          variant={sectionVariant}
        >
          {/* Edit mode has no catalog picker — the deployment already happened
          — but it renders what that deployment came from in the same place, so
          the endpoint does not read as two different things depending on which
          page you are on. */}
          <div className="col-span-4">
            <EndpointCatalogOrigin
              annotations={queryEndpoint?.metadata?.annotations}
            />
          </div>
          <div
            className={cn(
              "col-span-4 grid grid-cols-1 sm:grid-cols-4",
              FORM_GRID_GAP_CLASS,
            )}
          >
            <FormFieldGroup
              {...form}
              name="spec.replicas.num"
              label={t("endpoints.fields.replicas")}
              className="sm:col-span-1"
              required
            >
              <Input type="number" min={1} />
            </FormFieldGroup>
          </div>
          {!hidesModelFields && (
            <>
              <FormFieldGroup
                {...form}
                name="spec.model.registry"
                label={t("endpoints.fields.modelRegistry")}
                className="col-span-2"
                required
              >
                <FormCombobox
                  placeholder={t("endpoints.placeholders.selectModelRegistry")}
                  disabled={modelRegistries.query.isLoading}
                  options={modelRegistryOptions}
                  onChange={(value) => {
                    form.setValue(
                      "spec.model.registry",
                      value as string,
                      userSetValueOptions,
                    );
                    // Reset model name and search when registry changes
                    form.setValue("spec.model.name", "", userSetValueOptions);
                    form.setValue("spec.model.info", null, userSetValueOptions);
                    setModelSearch("");
                  }}
                />
              </FormFieldGroup>
              {/* The hints sit beside the field rather than inside it:
              FormFieldGroup clones the controller's `field` onto its child, so
              a wrapper around the combobox would take the keystrokes typed in
              its search box as changes to the model name. */}
              <div className="space-y-2 sm:col-span-2">
                <FormFieldGroup
                  {...form}
                  name="spec.model.name"
                  label={t("endpoints.fields.modelName")}
                  required
                >
                  <AsyncCombobox
                    placeholder={t("endpoints.placeholders.selectModel")}
                    loading={
                      modelsData.isFetching ? (
                        <CommandLoading className="px-2 py-1.5 text-muted-foreground">
                          {t("endpoints.messages.fetching")}
                        </CommandLoading>
                      ) : null
                    }
                    // Labelled by alias, valued by the physical name: the
                    // endpoint is stored against the name it is served under.
                    options={modelsData.models.map((e) => ({
                      label: registryModelLabel(e),
                      value: e.name,
                    }))}
                    shouldFilter={false}
                    onSearchChange={setModelSearch}
                    triggerClassName="w-full"
                    disabled={!currentRegistry}
                    value={currentModelName}
                    onChange={(value: string) => {
                      form.setValue(
                        "spec.model.name",
                        value,
                        userSetValueOptions,
                      );

                      // Empty, so the endpoint serves the bare model name and
                      // resolves the version as it deploys. A version here
                      // becomes part of the name callers send
                      // (`name:version`), and the registry lists versions in
                      // its own order — the first is not the newest, and for a
                      // model uploaded without one it is a generated id.
                      form.setValue(
                        "spec.model.version",
                        "",
                        userSetValueOptions,
                      );

                      // Cleared now and refilled when the detail read answers,
                      // so the previous model's parameters are never shown
                      // under this one's name.
                      form.setValue(
                        "spec.model.info",
                        null,
                        userSetValueOptions,
                      );
                      setPickedModelRef(
                        workspace && currentRegistry && value
                          ? {
                              workspace,
                              registry: currentRegistry,
                              model: value,
                            }
                          : null,
                      );
                    }}
                  />
                </FormFieldGroup>
                {/* Said here rather than in release notes: a model that is not
                on local storage is fetched when the endpoint starts, so the
                first start is slow and an air-gapped site cannot start it at
                all. Keyed off the registry's stated capability, so a second
                public provider inherits the warning without being named. */}
                {selectedModelDelivery === "at-deploy-time" && (
                  <Alert data-testid="endpoint-runtime-download-hint">
                    <AlertDescription>
                      {t("endpoints.messages.runtimeDownloadHint")}
                    </AlertDescription>
                  </Alert>
                )}
                {/* The registry answered without saying which kind it is,
                which only happens when a request here drops
                MODEL_REGISTRY_SELECT. Rendering nothing would take the warning
                above away with no symptom at all; this makes the omission
                visible to whoever is looking at the screen. */}
                {selectedModelDelivery === "unknown" && (
                  <Alert
                    variant="warning"
                    data-testid="endpoint-runtime-download-unknown"
                  >
                    <AlertDescription>
                      {t("endpoints.messages.runtimeDownloadUnknown")}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}
          {modelVersionFields}
        </FormCardGrid>
      </>
    ),
    runtimeFields: (
      <>
        {engineFields}
        <EndpointKVCacheFields
          form={form}
          cluster={selectedCluster}
          availability={kvCacheAvailability}
          isEdit={isEdit}
          cacheChanged={cacheChanged}
        />
      </>
    ),
    wizardEstimateFields,
    configurationSummaryFields,
    reviewContext,
    wizardStepCompletions: endpointStepCompletions(
      form.watch() as unknown as Endpoint,
      !hidesModelFields,
    ),
    // Scheduling target and resource selection section - always visible.
    resourceFields: (
      <FormCardGrid
        title={t("endpoints.sections.schedulingTargetResources")}
        variant={sectionVariant}
      >
        <div data-testid="endpoint-resource-config-grid" className="col-span-4">
          <section
            data-testid="endpoint-scheduling-target-card"
            className="w-full border-b pb-4"
          >
            <div className="grid w-full min-w-0 max-w-[520px] grid-cols-1 gap-3">
              <FormFieldGroup
                {...form}
                name="spec.cluster"
                label={t("common.fields.cluster")}
                labelAccessory={
                  <InfoHint
                    label={t("endpoints.descriptions.clusterSchedulingTarget")}
                  />
                }
                className="w-full max-w-[280px]"
                required
              >
                <FormCombobox
                  disabled={isEdit || clusters.query.isLoading}
                  placeholder={t("endpoints.placeholders.selectCluster")}
                  options={clusterOptions}
                />
              </FormFieldGroup>
            </div>
          </section>

          <div
            data-testid="endpoint-resource-layout-grid"
            className="grid gap-3 pt-4 min-[1366px]:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)] min-[1366px]:items-start min-[1366px]:gap-0"
          >
            <div
              data-testid="endpoint-resource-config-main"
              className="min-w-0 min-[1366px]:sticky min-[1366px]:top-4 min-[1366px]:pr-6"
            >
              <section
                data-testid="endpoint-resource-plan-card"
                className="grid gap-5"
              >
                <div
                  data-testid="endpoint-resource-plan-header"
                  className="flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold leading-6 text-foreground">
                      {t("endpoints.sections.resourcePlan")}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("endpoints.descriptions.basicResources")}
                    </p>
                  </div>
                </div>
                {!currentCluster && (
                  <EmptyState
                    variant="inline"
                    className="text-left"
                    data-testid="endpoint-resource-plan-empty"
                  >
                    {t("endpoints.placeholders.resourcePlanRequiresCluster")}
                  </EmptyState>
                )}
                <div
                  data-testid="endpoint-resource-request-grid"
                  className={cn(
                    "grid grid-cols-1 content-start items-start gap-3 self-start sm:grid-cols-2",
                    !currentCluster && "hidden",
                  )}
                >
                  <div
                    data-testid="endpoint-basic-resource-card"
                    className="contents"
                  >
                    <div className="col-span-1 space-y-1">
                      <FormFieldGroup
                        {...form}
                        name="spec.resources.cpu"
                        label={t("common.fields.cpu")}
                      >
                        <NumberInput
                          value={formatInputNumber(
                            normalizedResources?.cpu ?? 0,
                          )}
                          onValueChange={(value) =>
                            form.setValue(
                              "spec.resources.cpu",
                              value,
                              userSetValueOptions,
                            )
                          }
                          min={0}
                          max={maxAvailable.cpu.available}
                          step={0.1}
                          disabled={!currentCluster}
                          className="h-9"
                        />
                      </FormFieldGroup>
                      {hasClusterCapacityEvidence && isCpuCapacityExceeded && (
                        <p className="text-xs leading-4 text-destructive">
                          {hasNodeCpuPlacementCapacityExceeded
                            ? t(
                                "endpoints.messages.noNodeCanScheduleCpuRequest",
                              )
                            : t("endpoints.messages.cpuResourcesInsufficient")}
                        </p>
                      )}
                    </div>

                    <div className="col-span-1 space-y-1">
                      <FormFieldGroup
                        {...form}
                        name="spec.resources.memory"
                        label={t("endpoints.fields.memoryGb")}
                      >
                        <NumberInput
                          value={formatInputNumber(
                            normalizedResources?.memory ?? 0,
                          )}
                          onValueChange={(value) =>
                            form.setValue(
                              "spec.resources.memory",
                              value,
                              userSetValueOptions,
                            )
                          }
                          min={0}
                          max={maxAvailable.memory.available}
                          step={0.5}
                          disabled={!currentCluster}
                          className="h-9"
                        />
                      </FormFieldGroup>
                      {hasClusterCapacityEvidence &&
                        isMemoryCapacityExceeded && (
                          <p className="text-xs leading-4 text-destructive">
                            {hasNodeMemoryPlacementCapacityExceeded
                              ? t(
                                  "endpoints.messages.noNodeCanScheduleMemoryRequest",
                                )
                              : t(
                                  "endpoints.messages.memoryResourcesInsufficient",
                                )}
                          </p>
                        )}
                    </div>
                  </div>

                  <div
                    data-testid="endpoint-accelerator-resource-card"
                    className="contents"
                  >
                    <div
                      data-testid="endpoint-accelerator-allocator-row"
                      className="contents"
                    >
                      <FormFieldGroup
                        {...form}
                        name="spec.resources.accelerator"
                        label={t("endpoints.fields.accelerator")}
                        className="col-span-1 min-w-0 sm:col-span-2"
                        required
                      >
                        <FormCombobox
                          options={displayedAcceleratorOptions.map((opt) => ({
                            label: opt.label,
                            value: opt.value,
                            disabled: !opt.engineCompatible,
                            description: [
                              opt.engineCompatible
                                ? opt.verified
                                  ? t("endpoints.recipe.verifiedAccelerator")
                                  : null
                                : t(
                                    "endpoints.messages.engineAcceleratorIncompatible",
                                  ),
                              opt.capacityDescription,
                            ]
                              .filter(Boolean)
                              .join(" · "),
                          }))}
                          value={
                            selectedAccelerator?.type &&
                            selectedAccelerator?.product
                              ? `${selectedAccelerator.type}:${selectedAccelerator.product}`
                              : ""
                          }
                          onChange={(value) => {
                            // Parse "type:product" format
                            const selectedOption =
                              displayedAcceleratorOptions.find(
                                (opt) => opt.value === value,
                              );
                            if (selectedOption) {
                              const currentVirtualization = form.getValues(
                                "spec.resources.accelerator.virtualization",
                              );
                              form.setValue(
                                "spec.resources.accelerator",
                                {
                                  type: selectedOption.type,
                                  product: selectedOption.product,
                                  ...(isSelectedClusterVgpuEnabled
                                    ? {
                                        virtualization:
                                          currentVirtualization || {},
                                      }
                                    : {}),
                                } satisfies ResourceSpec["accelerator"],
                                userSetValueOptions,
                              );
                            } else {
                              form.setValue(
                                "spec.resources.accelerator",
                                null,
                                userSetValueOptions,
                              );
                            }
                          }}
                          placeholder={t(
                            "endpoints.placeholders.selectAccelerator",
                          )}
                          disabled={
                            !currentCluster ||
                            displayedAcceleratorOptions.length === 0
                          }
                          emptyMessage={t(
                            "endpoints.messages.noAcceleratorsAvailable",
                          )}
                        />
                      </FormFieldGroup>
                      {noVerifiedAcceleratorAvailable && (
                        // The recipe's validated GPU list has no overlap with
                        // this cluster — the picker above falls back to every
                        // available accelerator; surface that plus the VRAM
                        // floor so the fallback is an informed choice.
                        <div
                          data-testid="endpoint-accelerator-unverified-notice"
                          className="col-span-1 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground sm:col-span-2"
                        >
                          {t("endpoints.recipe.noVerifiedAccelerator")}
                          {requiredVramGb != null && (
                            <span className="ml-1">
                              {t(
                                "endpoints.recipe.requiredVram",
                                "Requires ≥ {{gb}} GB VRAM.",
                                { gb: formatGb(requiredVramGb) },
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {canUseVgpuAllocation && (
                      <div
                        data-testid="endpoint-gpu-allocation-mode"
                        className="col-span-1 min-w-0 space-y-2 sm:col-span-2"
                      >
                        <div className="text-sm font-medium leading-none text-foreground">
                          {t("endpoints.fields.allocationMode")}
                        </div>
                        <SegmentedControl
                          ariaLabel={t("endpoints.fields.allocationMode")}
                          value={effectiveGpuAllocationMode}
                          onValueChange={handleGpuAllocationModeChange}
                          items={[
                            {
                              value: "full",
                              label: t("endpoints.fields.fullGpu"),
                            },
                            {
                              value: "vgpu",
                              label: t("endpoints.fields.vgpu"),
                            },
                          ]}
                        />
                      </div>
                    )}

                    <div className="col-span-1 space-y-1">
                      <FormFieldGroup
                        {...form}
                        name="spec.resources.gpu"
                        label={t(
                          isVgpuAllocationMode
                            ? "endpoints.fields.vgpuCount"
                            : "endpoints.fields.physicalGpuCount",
                        )}
                      >
                        <NumberInput
                          value={formatInputNumber(gpuUsage)}
                          onValueChange={(value) =>
                            form.setValue(
                              "spec.resources.gpu",
                              value,
                              userSetValueOptions,
                            )
                          }
                          min={0}
                          // Capacity is a cross-field constraint:
                          // cardsPerReplica × replicas. Keeping it out of the
                          // input max avoids lowering the ceiling to the
                          // current value and lets the capacity message own
                          // the verdict.
                          // SSH clusters step by 0.1 below one card and by whole
                          // cards at or above one, so the spinner never lands on
                          // a value the precision rule rejects. Kubernetes (and
                          // vGPU, which is Kubernetes-only) always step by 1.
                          step={gpuInputStep}
                          disabled={
                            !currentCluster ||
                            !selectedAccelerator?.type ||
                            !selectedAccelerator?.product
                          }
                          className="h-9"
                        />
                      </FormFieldGroup>
                      {gpuCapacityMessageList}
                    </div>

                    {/* Keep the split controls tied to the explicit mode.
                        Showing them while full-card allocation is selected made
                        a blank VRAM field look like an alternative value rather
                        than a different resource request. */}
                    {isVgpuAllocationMode && (
                      <div
                        data-testid="endpoint-virtual-card-split-group"
                        className="col-span-1 grid gap-3 rounded-lg border bg-muted/20 p-3 sm:col-span-2 sm:grid-cols-2"
                      >
                        <div className="col-span-1 flex items-center justify-between gap-3 text-xs font-medium sm:col-span-2">
                          <span className="text-foreground">
                            {t("endpoints.sections.virtualCardSplitResources")}
                          </span>
                          <Badge variant="outline" className="font-normal">
                            {t("endpoints.fields.perCard")}
                          </Badge>
                        </div>
                        <FormFieldGroup
                          {...form}
                          name="spec.resources.accelerator.virtualization.memory_mib"
                          label={t("endpoints.fields.singleCardMemory")}
                          className="col-span-1"
                          required
                        >
                          <Input
                            type="number"
                            aria-label={t("endpoints.fields.singleCardMemory")}
                            value={vgpuMemoryGiBInputValue}
                            onChange={(event) =>
                              setSingleCardMemoryGiB(event.target.value)
                            }
                            min={0}
                            max={vgpuMemoryGiBMaxValue ?? undefined}
                            step={0.5}
                            disabled={
                              !showVgpuFields || !isVgpuMemoryResourceSupported
                            }
                            placeholder="GiB"
                            className="h-9"
                          />
                        </FormFieldGroup>

                        <FormFieldGroup
                          {...form}
                          name="spec.resources.accelerator.virtualization.core_percent"
                          label={t("endpoints.fields.vgpuCoreLimit")}
                          description={t(
                            isVgpuCoreResourceSupported
                              ? "endpoints.messages.vgpuCoreLimitUnlimitedHint"
                              : "endpoints.messages.vgpuCoreLimitUnsupportedMode",
                          )}
                          className="col-span-1"
                        >
                          <Input
                            type="number"
                            aria-label={t("endpoints.fields.vgpuCoreLimit")}
                            value={
                              showVgpuFields && vgpuCoreUnitsPerCard > 0
                                ? formatInputNumber(vgpuCoreUnitsPerCard)
                                : ""
                            }
                            onChange={(event) =>
                              setCoreLimitPercent(event.target.value)
                            }
                            min={0}
                            max={100}
                            step={1}
                            disabled={
                              !showVgpuFields || !isVgpuCoreResourceSupported
                            }
                            placeholder={
                              showVgpuFields && isVgpuCoreResourceSupported
                                ? "0"
                                : t("common.options.disabled")
                            }
                            className="h-9"
                          />
                        </FormFieldGroup>
                      </div>
                    )}
                  </div>

                  {/* Capacity feedback sits beside the card count so users do
                      not choose one without seeing whether it can be placed. */}
                  {currentCluster &&
                    selectedAccelerator?.type &&
                    selectedAccelerator?.product && (
                      <div
                        data-testid="endpoint-current-request-panel"
                        className="col-span-1 text-sm sm:col-span-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">
                            {t("endpoints.sections.currentRequest")}
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              data-testid="endpoint-capacity-status"
                              className={cn(
                                "font-normal",
                                !isVgpuCapacityPending &&
                                  getCapacityBadgeClassName(
                                    isVgpuAllocationMode
                                      ? isVgpuCapacityExceededWithPlacement
                                      : isFullGpuCapacityExceededWithPlacement,
                                  ),
                              )}
                            >
                              {isVgpuCapacityPending
                                ? t("endpoints.messages.vgpuCapacityPending")
                                : t("endpoints.messages.cardsAvailable", {
                                    count: isVgpuAllocationMode
                                      ? totalVirtualCardCapacity
                                      : fullGpuCardCapacity,
                                  })}
                            </Badge>
                            <InfoHint
                              label={t("endpoints.messages.cardsAvailableHint")}
                            />
                          </div>
                        </div>
                        <div
                          data-testid="endpoint-current-request-grid"
                          className="mt-2 grid grid-cols-2 border-y border-[var(--nt-stroke-neutral-trans-2)] [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-[var(--nt-stroke-neutral-trans-2)]"
                        >
                          {[
                            {
                              key: "cards",
                              label: t("endpoints.fields.virtualCardCount"),
                              unit: undefined,
                              value: isVgpuAllocationMode ? (
                                isVgpuCapacityPending ? (
                                  <EmptyValue />
                                ) : (
                                  `${formatOneDecimal(
                                    displayedVgpuPhysicalCards,
                                  )} / ${formatOneDecimal(
                                    totalVirtualCardCapacity,
                                  )}`
                                )
                              ) : (
                                `${formatOneDecimal(
                                  requestedFullGpuCards,
                                )} / ${formatOneDecimal(fullGpuCardCapacity)}`
                              ),
                            },
                            ...(isVgpuAllocationMode
                              ? [
                                  {
                                    key: "memory",
                                    label: t(
                                      "endpoints.fields.vgpuMemoryCapacity",
                                    ),
                                    unit: "GiB",
                                    value: isVgpuCapacityPending ? (
                                      <EmptyValue />
                                    ) : (
                                      `${formatOneDecimal(
                                        requestedVgpuMemoryMiB / 1024,
                                      )} / ${formatOneDecimal(
                                        availableVgpuMemoryMiB / 1024,
                                      )}`
                                    ),
                                  },
                                  {
                                    key: "core",
                                    label: t(
                                      "endpoints.fields.vgpuCoreCapacity",
                                    ),
                                    unit: undefined,
                                    value:
                                      !isVgpuCapacityPending &&
                                      currentRequestCoreUnitsPerCard > 0 ? (
                                        `${formatOneDecimal(
                                          currentRequestCoreUnits,
                                        )} / ${formatOneDecimal(
                                          currentRequestAvailableCoreUnits,
                                        )}`
                                      ) : (
                                        <EmptyValue />
                                      ),
                                  },
                                ]
                              : []),
                            {
                              key: "scheduling",
                              label: t("endpoints.fields.scheduling"),
                              unit: undefined,
                              value: t("common.fields.cluster"),
                            },
                          ].map((metric) => (
                            <div
                              key={metric.key}
                              className="min-w-0 px-3 py-2 even:border-l even:border-[var(--nt-stroke-neutral-trans-2)]"
                            >
                              <div className="flex items-baseline gap-1.5 text-xs font-medium text-muted-foreground">
                                <span className="min-w-0 break-words">
                                  {metric.label}
                                </span>
                                {metric.unit && (
                                  <span className="shrink-0 text-[11px]">
                                    {metric.unit}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 whitespace-nowrap font-semibold tabular-nums">
                                {metric.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </section>
            </div>
            <div
              data-testid="endpoint-resource-context"
              className="min-w-0 border-t pt-5 min-[1366px]:sticky min-[1366px]:top-4 min-[1366px]:self-start min-[1366px]:border-l min-[1366px]:border-t-0 min-[1366px]:pl-6 min-[1366px]:pt-0"
            >
              {clusterGpuResourcesPanel}
            </div>
          </div>
        </div>

        {/* Cluster status indicator */}
        {currentCluster && !clusterResources && (
          <div className="col-span-4 mt-2">
            <div className="text-sm text-yellow-600">
              {t("endpoints.messages.clusterResourcesUnavailable")}
            </div>
          </div>
        )}
      </FormCardGrid>
    ),
    // Advanced settings keep endpoint deployment controls and runtime details.
    customizeFields: (
      <FormCardGrid
        title={t("endpoints.sections.advancedOptions")}
        variant={sectionVariant}
      >
        <FormFieldGroup
          {...form}
          name="spec.deployment_options.scheduler.type"
          label={t("endpoints.fields.schedulerType")}
          className="col-span-1"
        >
          <FormCombobox
            placeholder={t("endpoints.placeholders.selectSchedulerType")}
            options={[
              {
                label: t("models.scheduler.roundRobin"),
                value: "roundrobin",
              },
              {
                label: t("models.scheduler.consistentHashing"),
                value: "consistent_hash",
              },
            ]}
          />
        </FormFieldGroup>

        <FormFieldGroup
          {...form}
          name="spec.variables.engine_args"
          label={t("endpoints.fields.engineVariables")}
          className="col-span-4"
        >
          <VariablesInput
            schema={engineValueSchema?.properties as unknown as Schema}
            // Recognised by engine name and argument key, the same way the
            // model fields are hidden for an engine that needs none. Another
            // engine with an image argument keeps the plain text box until the
            // console is taught about it: a convenience too few, never a field
            // too few. Both cases converge on an engine declaration later.
            valueInputs={
              engineSpec?.engine === "flex"
                ? {
                    image: ({ value, onChange }) => (
                      <WorkloadImageInput
                        value={value}
                        onChange={onChange}
                        workspace={workspace}
                        registry={selectedCluster?.spec?.image_registry}
                      />
                    ),
                  }
                : undefined
            }
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.env"
          label={t("endpoints.fields.environment")}
          className="col-span-4"
        >
          <VariablesInput schema={{}} />
        </FormFieldGroup>
      </FormCardGrid>
    ),
  };
};
