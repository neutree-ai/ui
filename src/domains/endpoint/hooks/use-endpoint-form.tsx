import { useCustom, useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { ChevronDown, CircleHelp, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Path, PathValue } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox as AsyncCombobox } from "@/components/ui/combobox";
import { CommandLoading } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ComposePreview } from "@/domains/endpoint/components/ComposePreview";
import { EndpointClusterGpuResourcesPanel } from "@/domains/endpoint/components/EndpointClusterGpuResourcesPanel";
import { FeaturePicker } from "@/domains/endpoint/components/FeaturePicker";
import { formatTaskName } from "@/domains/endpoint/components/ModelTask";
import { VariantPicker } from "@/domains/endpoint/components/VariantPicker";
import { VRAMCheckBadge } from "@/domains/endpoint/components/VRAMCheckBadge";
import { useEndpointClusterResources } from "@/domains/endpoint/hooks/use-endpoint-cluster-resources";
import { useEndpointEngineOptions } from "@/domains/endpoint/hooks/use-endpoint-engine-options";
import useEndpointResources from "@/domains/endpoint/hooks/use-endpoint-resources";
import {
  buildCatalogMergedSpec,
  defaultEndpointSpec,
  normalizeEndpointRecordForForm,
  normalizeEndpointResourcesForForm,
  transformEndpointValues,
  validateEndpointValues,
} from "@/domains/endpoint/lib/endpoint-form-helpers";
import { getEffectiveVgpuMemoryMiB } from "@/domains/endpoint/lib/vgpu";
import type {
  Endpoint,
  EndpointClusterRef,
  EndpointEngineRef,
  EndpointModelCatalogRef,
  EndpointModelRegistryRef,
  ResourceSpec,
} from "@/domains/endpoint/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { NumberInput } from "@/foundation/components/NumberInput";
import { VariablesInput } from "@/foundation/components/VariablesInput";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import type { Schema } from "@/foundation/hooks/use-variables-input";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import {
  calculateVgpuCardCapacity,
  countFullCardAvailableDevicesByProduct,
} from "@/foundation/lib/gpu-device-resources";
import { cn } from "@/foundation/lib/utils";
import {
  composeEndpointSpec,
  defaultFeatureSelections,
} from "@/foundation/recipe/compose";
import { DEFAULT_VARIANT, isRecipeShape } from "@/foundation/recipe/normalize";
import type {
  ComposedSpec,
  FeatureSelection,
  RecipeInputSpec,
} from "@/foundation/recipe/types";

// Reads `?model_catalog=<id>` off the current URL. The app uses a HashRouter so
// the query lives in location.hash ("#/ws/endpoints/create?model_catalog=1").
// Returns "" when absent or outside a browser (e.g. unit tests), so callers can
// treat it as "no preselection".
function readModelCatalogQueryParam(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash ?? "";
  const q = hash.indexOf("?");
  if (q === -1) return "";
  return new URLSearchParams(hash.slice(q + 1)).get("model_catalog") ?? "";
}

type AcceleratorVirtualization = NonNullable<
  ResourceSpec["accelerator"]
>["virtualization"];
type GpuAllocationMode = "full" | "vgpu";

const hasVgpuVirtualizationValues = (
  virtualization: AcceleratorVirtualization | undefined,
) =>
  Boolean(
    virtualization?.memory_mib ||
      virtualization?.memory_percent ||
      virtualization?.core_percent,
  );

const userSetValueOptions = {
  shouldDirty: true,
  shouldTouch: true,
  shouldValidate: true,
} as const;

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
  const [selectedModelCatalog, setSelectedModelCatalog] = useState<string>("");
  const [modelSearch, setModelSearch] = useState("");
  // Recipe-mode state: only meaningful when the selected catalog is a Recipe MC.
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [featureSelections, setFeatureSelections] = useState<FeatureSelection[]>([]);
  // Simplified-mode disclosure: when deploying from a Recipe catalog card the
  // model/engine/resources are auto-configured from the chosen variant, so the
  // raw fields and advanced resource controls start collapsed behind this toggle.
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<Endpoint>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "Endpoint",
      metadata: {
        name: "",
        workspace: currentWorkspace,
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
    },
    warnWhenUnsavedChanges: true,
    resolver: (values) => {
      const errors = validateEndpointValues(
        values.spec,
        {
          action,
          currentRegistry,
          currentModelName,
          availableModelNames: (modelsData.data?.data || []).map(
            (m: { name: string }) => m.name,
          ),
        },
        t,
      );
      return { values, errors };
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
  const currentCluster = form.watch("spec.cluster");
  const engineSpec = form.watch("spec.engine");

  const selectedAccelerator = normalizedResources?.accelerator;
  const gpuUsage = normalizedResources?.gpu || 0;
  const replicaCount = Math.max(1, Number(watchedReplicaCount || 1));

  const currentEndpointAccelerator = normalizedQueryResources?.accelerator;
  const currentEndpointReplicaCount =
    action === "edit"
      ? Math.max(1, Number(queryEndpoint?.spec?.replicas?.num || 1))
      : 0;
  const canReuseCurrentEndpointResources = Boolean(
    action === "edit" &&
      queryEndpoint?.spec?.cluster &&
      queryEndpoint.spec.cluster === currentCluster,
  );
  const canReuseCurrentEndpointAccelerator = Boolean(
    canReuseCurrentEndpointResources &&
      selectedAccelerator?.type &&
      selectedAccelerator?.product &&
      currentEndpointAccelerator?.type === selectedAccelerator.type &&
      currentEndpointAccelerator?.product === selectedAccelerator.product,
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

  const meta = useMemo(
    () => ({
      workspace,
      workspaced: true,
    }),
    [workspace],
  );

  const engines = useSelect<EndpointEngineRef>({
    resource: "engines",
    meta,
  });

  const clusters = useSelect<EndpointClusterRef>({
    resource: "clusters",
    meta,
  });

  const modelRegistries = useSelect<EndpointModelRegistryRef>({
    resource: "model_registries",
    meta,
  });

  const modelCatalogs = useSelect<EndpointModelCatalogRef>({
    resource: "model_catalogs",
    meta,
  });

  const {
    selectedCluster,
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
  });

  const isEdit = action === "edit";

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
  const selectedClusterNodeCountText =
    selectedClusterNodeCount === null ? "-" : String(selectedClusterNodeCount);
  const selectedMemoryTotalMiB = selectedAcceleratorOption?.memoryTotalMiB;
  const effectiveVgpuMemoryMiB = getEffectiveVgpuMemoryMiB(
    selectedVirtualization,
    selectedMemoryTotalMiB,
  );
  const vgpuMemoryGiBInputValue =
    selectedVirtualization?.memory_mib !== undefined
      ? formatInputNumber(Number(selectedVirtualization.memory_mib) / 1024)
      : effectiveVgpuMemoryMiB
        ? formatInputNumber(effectiveVgpuMemoryMiB / 1024)
        : "";
  const effectiveGpuAllocationMode: GpuAllocationMode =
    showVgpuFields && effectiveVgpuMemoryMiB ? "vgpu" : "full";
  const isVgpuAllocationMode = effectiveGpuAllocationMode === "vgpu";
  const vgpuCoreUnitsPerCard = Number(
    selectedVirtualization?.core_percent || 0,
  );
  const vgpuCardCapacity = useMemo(
    () =>
      calculateVgpuCardCapacity(
        selectedCluster?.status?.resource_info?.node_resources,
        {
          selectedAccelerator,
          memoryMiBPerCard: effectiveVgpuMemoryMiB,
          coreUnitsPerCard: vgpuCoreUnitsPerCard,
        },
      ),
    [
      selectedCluster?.status?.resource_info?.node_resources,
      selectedAccelerator,
      effectiveVgpuMemoryMiB,
      vgpuCoreUnitsPerCard,
    ],
  );
  const requestedVirtualCards = gpuUsage * replicaCount;
  const requestedFullGpuCards = gpuUsage * replicaCount;
  const requestedVgpuMemoryMiB = effectiveVgpuMemoryMiB
    ? requestedVirtualCards * effectiveVgpuMemoryMiB
    : 0;
  const requestedVgpuCoreUnits = vgpuCoreUnitsPerCard
    ? requestedVirtualCards * vgpuCoreUnitsPerCard
    : 0;
  const availableFullGpuCards = useMemo(() => {
    if (!selectedAccelerator?.product) {
      return 0;
    }

    const availableDeviceCount = countFullCardAvailableDevicesByProduct(
      selectedCluster?.status?.resource_info?.node_resources,
    ).get(selectedAccelerator.product);

    return (
      availableDeviceCount ??
      selectedAcceleratorOption?.available ??
      maxAvailable.gpu.available
    );
  }, [
    maxAvailable.gpu.available,
    selectedAccelerator?.product,
    selectedAcceleratorOption?.available,
    selectedCluster?.status?.resource_info?.node_resources,
  ]);
  const reusableFullGpuCards =
    canReuseCurrentEndpointAccelerator && !isCurrentEndpointVgpuAllocation
      ? Number(normalizedQueryResources?.gpu || 0) * currentEndpointReplicaCount
      : 0;
  const fullGpuCardCapacity = availableFullGpuCards + reusableFullGpuCards;
  const additionalFullGpuCards = Math.max(
    0,
    requestedFullGpuCards - reusableFullGpuCards,
  );
  const currentEndpointProductUsage =
    canReuseCurrentEndpointAccelerator &&
    isCurrentEndpointVgpuAllocation &&
    selectedAccelerator?.product
      ? form.refineCore.query?.data?.data?.status?.resources?.summary
          ?.products?.[selectedAccelerator.product]
      : undefined;
  const reusableVgpuMemoryMiB = Number(
    currentEndpointProductUsage?.memory_mib || 0,
  );
  const reusableVgpuCoreUnits = Number(
    currentEndpointProductUsage?.core_units || 0,
  );
  const reusableVirtualCards = effectiveVgpuMemoryMiB
    ? vgpuCoreUnitsPerCard > 0
      ? Math.min(
          Math.floor(reusableVgpuMemoryMiB / effectiveVgpuMemoryMiB),
          Math.floor(reusableVgpuCoreUnits / vgpuCoreUnitsPerCard),
        )
      : Math.floor(reusableVgpuMemoryMiB / effectiveVgpuMemoryMiB)
    : 0;
  const rawAvailableVgpuMemoryMiB = Number(
    selectedAcceleratorOption?.virtualizationMemoryMiB || 0,
  );
  const rawAvailableVgpuCoreUnits = Number(
    selectedAcceleratorOption?.virtualizationCoreUnits || 0,
  );
  const availableVgpuMemoryMiB =
    rawAvailableVgpuMemoryMiB + reusableVgpuMemoryMiB;
  const availableVgpuCoreUnits =
    rawAvailableVgpuCoreUnits + reusableVgpuCoreUnits;
  const totalVirtualCardCapacity =
    vgpuCardCapacity.totalCards + reusableVirtualCards;
  const maxVirtualCardsPerReplica = Math.floor(
    totalVirtualCardCapacity / replicaCount,
  );
  const additionalVirtualCards = Math.max(
    0,
    requestedVirtualCards - reusableVirtualCards,
  );
  const additionalVgpuMemoryMiB = Math.max(
    0,
    requestedVgpuMemoryMiB - reusableVgpuMemoryMiB,
  );
  const additionalVgpuCoreUnits = Math.max(
    0,
    requestedVgpuCoreUnits - reusableVgpuCoreUnits,
  );
  const isVgpuCapacityExceeded = Boolean(
    isVgpuAllocationMode &&
      selectedAccelerator?.product &&
      (additionalVirtualCards > vgpuCardCapacity.totalCards ||
        ((rawAvailableVgpuMemoryMiB > 0 || reusableVgpuMemoryMiB > 0) &&
          additionalVgpuMemoryMiB > rawAvailableVgpuMemoryMiB) ||
        ((rawAvailableVgpuCoreUnits > 0 || reusableVgpuCoreUnits > 0) &&
          additionalVgpuCoreUnits > rawAvailableVgpuCoreUnits)),
  );
  const isFullGpuCapacityExceeded = Boolean(
    !isVgpuAllocationMode &&
      selectedAccelerator?.type &&
      selectedAccelerator?.product &&
      additionalFullGpuCards > availableFullGpuCards,
  );

  useEffect(() => {
    if (
      hasResolvedClusterSelection &&
      !isSelectedClusterVgpuEnabled &&
      selectedVirtualization
    ) {
      form.setValue("spec.resources.accelerator.virtualization", undefined, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [
    form,
    hasResolvedClusterSelection,
    isSelectedClusterVgpuEnabled,
    selectedVirtualization,
  ]);

  const setSingleCardMemoryGiB = (rawValue: string) => {
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

    form.setValue(
      "spec.resources.accelerator.virtualization",
      {
        ...(coreOnlyVirtualization ?? {}),
        memory_mib: Math.ceil(memoryGiB * 1024),
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

  const modelsData = useCustom({
    url: `/workspaces/${workspace}/model_registries/${currentRegistry}/models?${effectiveModelSearch ? `search=${effectiveModelSearch}` : ""}&limit=20`,
    method: "get",
    queryOptions: {
      enabled: Boolean(currentRegistry),
    },
  });

  const { engineNames, engineVersions, engineTasks, engineValueSchema } =
    useEndpointEngineOptions({
      enginesData: engines.query.data?.data,
      engineSpec,
    });

  // Set each key of obj as a separate form.setValue call, recursing into
  // nested plain objects. This ensures mounted FormField controllers get
  // notified, because useController uses useWatch with exact:true and
  // only reacts to setValue calls whose path exactly matches the field name.
  const setLeafValues = useCallback(
    (basePath: string, obj: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(obj)) {
        const path = `${basePath}.${key}` as Path<Endpoint>;
        form.setValue(path, value as PathValue<Endpoint, typeof path>);
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

  // Live composition for Recipe MCs — used for preview and for populating the
  // legacy form fields on selection / when the user toggles features/variant.
  const composeResult = useMemo(() => {
    if (!selectedCatalog || !isRecipeCatalog) return null;
    return composeEndpointSpec(
      selectedCatalog.spec as RecipeInputSpec,
      selectedVariant,
      featureSelections,
    );
  }, [selectedCatalog, isRecipeCatalog, selectedVariant, featureSelections]);

  // Apply a composed Recipe spec onto the form. Mirrors `applyCatalogSpec`'s
  // semantics (deep-merge over defaults) but uses the ComposedSpec fields and
  // additionally writes the new ref fields (model_catalog/variant/feature_selections).
  const applyComposedToForm = (
    catalogName: string,
    variant: string,
    selections: FeatureSelection[],
    composed: ComposedSpec,
  ) => {
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
    for (const [key, value] of Object.entries(merged)) {
      setLeafValues(`spec.${key}`, value);
    }
    // Double-write the recipe refs so the backend has the option of
    // recomposing in the future without losing the user's selection.
    form.setValue("spec.model_catalog" as any, catalogName);
    form.setValue("spec.variant" as any, variant || DEFAULT_VARIANT);
    form.setValue("spec.feature_selections" as any, selections);
  };

  // Handle model catalog selection with merge logic. Trivial MCs go through
  // the original `applyCatalogSpec` path; Recipe MCs go through the composer.
  const handleModelCatalogSelect = (catalogId: string) => {
    setSelectedModelCatalog(catalogId);

    if (!catalogId) {
      applyCatalogSpec(null);
      // Clear recipe ref fields when going back to "none"
      form.setValue("spec.model_catalog" as any, "");
      form.setValue("spec.variant" as any, "");
      form.setValue("spec.feature_selections" as any, []);
      setSelectedVariant("");
      setFeatureSelections([]);
      return;
    }

    const catalog = modelCatalogs.query.data?.data.find(
      (c) => c.id.toString() === catalogId,
    );
    if (!catalog) return;

    if (isRecipeShape(catalog.spec)) {
      // Recipe path — initialize variant/features defaults, then compose.
      const variants = Object.keys(catalog.spec.variants ?? {});
      const initialVariant = variants.includes(DEFAULT_VARIANT)
        ? DEFAULT_VARIANT
        : (variants[0] ?? DEFAULT_VARIANT);
      const initialFeatures = defaultFeatureSelections(
        catalog.spec as RecipeInputSpec,
      );
      setSelectedVariant(initialVariant);
      setFeatureSelections(initialFeatures);
      const result = composeEndpointSpec(
        catalog.spec as RecipeInputSpec,
        initialVariant,
        initialFeatures,
      );
      if (result.ok) {
        applyComposedToForm(
          catalog.metadata.name,
          initialVariant,
          initialFeatures,
          result.spec,
        );
      }
    } else {
      // Trivial path — current behavior, unchanged.
      applyCatalogSpec(catalog.spec as Record<string, unknown>);
      form.setValue("spec.model_catalog" as any, "");
      form.setValue("spec.variant" as any, "");
      form.setValue("spec.feature_selections" as any, []);
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
  const [preselectCatalogId] = useState(() =>
    action === "create" ? readModelCatalogQueryParam() : "",
  );
  const preselectAppliedRef = useRef(false);
  useEffect(() => {
    if (preselectAppliedRef.current || !preselectCatalogId) return;
    const list = modelCatalogs.query.data?.data;
    if (!list?.some((c) => c.id.toString() === preselectCatalogId)) return;
    preselectAppliedRef.current = true;
    handleModelCatalogSelect(preselectCatalogId);
    // handleModelCatalogSelect is stable enough for a one-shot guarded apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectCatalogId, modelCatalogs.query.data]);

  // When user changes variant or features, re-apply the composed result.
  const handleVariantChange = (v: string) => {
    setSelectedVariant(v);
    if (!selectedCatalog) return;
    const result = composeEndpointSpec(
      selectedCatalog.spec as RecipeInputSpec,
      v,
      featureSelections,
    );
    if (result.ok) {
      applyComposedToForm(
        selectedCatalog.metadata.name,
        v,
        featureSelections,
        result.spec,
      );
    }
  };

  const handleFeaturesChange = (next: FeatureSelection[]) => {
    setFeatureSelections(next);
    if (!selectedCatalog) return;
    const result = composeEndpointSpec(
      selectedCatalog.spec as RecipeInputSpec,
      selectedVariant,
      next,
    );
    if (result.ok) {
      applyComposedToForm(
        selectedCatalog.metadata.name,
        selectedVariant,
        next,
        result.spec,
      );
    }
  };

  const clusterGpuResourcesPanel = currentCluster ? (
    <EndpointClusterGpuResourcesPanel
      resourceInfo={selectedCluster?.status?.resource_info}
      currentCluster={currentCluster}
      selectedAccelerator={selectedAccelerator}
      virtualizationEnabled={isSelectedClusterVgpuEnabled}
      request={{
        allocationMode: effectiveGpuAllocationMode,
        requestedFullGpuCards,
        fullGpuCardCapacity,
        fullGpuCapacityExceeded: isFullGpuCapacityExceeded,
        requestedVirtualCards,
        totalVirtualCardCapacity,
        requestedVgpuMemoryMiB,
        availableVgpuMemoryMiB,
        requestedVgpuCoreUnits,
        availableVgpuCoreUnits,
        memoryMiBPerCard: effectiveVgpuMemoryMiB,
        coreUnitsPerCard: vgpuCoreUnitsPerCard,
        vgpuCapacityExceeded: isVgpuCapacityExceeded,
      }}
      t={t}
    />
  ) : null;

  // Simplified mode applies only to creating an endpoint from a Recipe catalog
  // (the "deploy from card" entry). In that flow model/engine/resources are
  // already composed from the variant, so we hide the raw fields by default and
  // surface only the essentials (variant, replicas, cluster, accelerator) plus a
  // lightweight resource estimate. `showFull` re-reveals every advanced control.
  const simplified = !isEdit && isRecipeCatalog && Boolean(selectedCatalog);
  const showFull = !simplified || showAdvanced;

  // Active variant + its display metadata, used for the estimate summary.
  const activeVariant =
    selectedCatalog?.spec.variants?.[selectedVariant] ??
    selectedCatalog?.spec.variants?.["default"];
  const activeVariantVram = activeVariant?.vram_minimum_gb ?? null;
  const estimatedTotalVramGb =
    activeVariantVram != null ? activeVariantVram * replicaCount : null;
  const activeModelInfo = activeVariant?.model?.info ?? null;

  const formWithTransformedOnFinish = {
    ...form,
    refineCore: {
      ...form.refineCore,
      onFinish: async (
        values: Parameters<typeof form.refineCore.onFinish>[0],
      ) => {
        const transformedValues =
          typeof structuredClone === "function"
            ? structuredClone(values)
            : JSON.parse(JSON.stringify(values));
        transformEndpointValues((transformedValues as Endpoint).spec);
        return form.refineCore.onFinish(transformedValues);
      },
    },
  };

  return {
    form: formWithTransformedOnFinish,
    metadataFields: (
      <FormCardGrid title={t("common.sections.basicInformation")}>
        <FormFieldGroup
          {...form}
          name="metadata.name"
          label={t("common.fields.name")}
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
        >
          <WorkspaceField disabled={isEdit} />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    // Endpoint configuration order: Model & Replicas -> Engine -> Scheduling target and resources.
    templateFields: (
      <>
        <FormCardGrid title={t("endpoints.sections.modelAndReplicas")}>
          {!isEdit && (
            <div
              data-testid="model-catalog-row"
              className="col-span-4 grid grid-cols-4 gap-4 xs:grid-cols-1"
            >
              <FormFieldGroup
                {...form}
                name="-model-catalog"
                label={t("endpoints.fields.modelCatalog")}
                className="col-span-1"
              >
                <FormCombobox
                  placeholder={t("endpoints.placeholders.selectModelCatalog")}
                  disabled={modelCatalogs.query.isLoading}
                  options={[
                    { label: t("common.options.none"), value: "" },
                    ...(modelCatalogs.query.data?.data || []).map((e) => ({
                      label: e.metadata.name,
                      value: e.id.toString(),
                    })),
                  ]}
                  value={selectedModelCatalog}
                  onChange={(value) =>
                    handleModelCatalogSelect(value as string)
                  }
                />
              </FormFieldGroup>
            </div>
          )}
          {showFull && (
            <>
          <FormFieldGroup
            {...form}
            name="spec.model.registry"
            label={t("endpoints.fields.modelRegistry")}
          >
            <FormCombobox
              placeholder={t("endpoints.placeholders.selectModelRegistry")}
              disabled={modelRegistries.query.isLoading}
              options={(modelRegistries.query.data?.data || []).map((e) => ({
                label: e.metadata.name,
                value: e.metadata.name,
              }))}
              onChange={(value) => {
                form.setValue("spec.model.registry", value as string);
                // Reset model name and search when registry changes
                form.setValue("spec.model.name", "");
                setModelSearch("");
              }}
            />
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            name="spec.model.name"
            label={t("endpoints.fields.modelName")}
          >
            <div className="space-y-2">
              <AsyncCombobox
                placeholder={t("endpoints.placeholders.selectModel")}
                loading={
                  modelsData.isFetching ? (
                    <CommandLoading className="px-2 py-1.5 text-muted-foreground">
                      {t("endpoints.messages.fetching")}
                    </CommandLoading>
                  ) : null
                }
                options={(modelsData.data?.data || []).map(
                  (e: { name: string }) => {
                    return {
                      label: e.name,
                      value: e.name,
                    };
                  },
                )}
                shouldFilter={false}
                onSearchChange={setModelSearch}
                triggerClassName="w-full"
                disabled={!currentRegistry}
                value={currentModelName}
                onChange={(value: string) => {
                  form.setValue("spec.model.name", value);
                }}
              />
            </div>
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            name="spec.model.version"
            label={t("endpoints.fields.modelVersion")}
          >
            <Input />
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            name="spec.model.file"
            label={t("endpoints.fields.modelFile")}
          >
            <Input />
          </FormFieldGroup>
            </>
          )}
          <FormFieldGroup
            {...form}
            name="spec.replicas.num"
            label={t("endpoints.fields.replicas")}
          >
            <Input type="number" min={1} />
          </FormFieldGroup>
        </FormCardGrid>

        {showFull && (
        <FormCardGrid title={t("endpoints.sections.engineSettings")}>
          <FormFieldGroup
            {...form}
            name="spec.engine.engine"
            label={t("common.fields.engine")}
          >
            <FormCombobox
              placeholder={t("endpoints.placeholders.selectEngine")}
              disabled={engines.query.isLoading}
              options={engineNames.map((v) => ({
                label: v,
                value: v,
              }))}
              onChange={(value) => {
                form.setValue("spec.engine", {
                  engine: value,
                  version: engineVersions[String(value)][0].version,
                });
                form.setValue("spec.model.task", engineTasks[String(value)][0]);
                form.trigger("spec.engine.engine");
              }}
            />
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            name="spec.engine.version"
            label={t("endpoints.fields.engineVersion")}
          >
            <FormCombobox
              placeholder={t("endpoints.placeholders.selectVersion")}
              disabled={!form.getValues().spec.engine.engine}
              options={(
                engineVersions[form.getValues().spec.engine.engine] || []
              ).map(({ version: v }) => ({
                label: v,
                value: v,
              }))}
            />
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            name="spec.model.task"
            label={t("endpoints.fields.taskType")}
          >
            <FormCombobox
              placeholder={t("endpoints.placeholders.selectTaskType")}
              disabled={!form.getValues().spec.engine.engine}
              options={(
                engineTasks[form.getValues().spec.engine.engine] || []
              ).map((v) => ({
                label:
                  t(`models.tasks.${v}`) === `models.tasks.${v}`
                    ? formatTaskName(v)
                    : t(`models.tasks.${v}`),
                value: v,
              }))}
            />
          </FormFieldGroup>
        </FormCardGrid>
        )}
      </>
    ),
    // Recipe selection section — shown only when the selected MC is a Recipe MC.
    // For trivial MCs this returns `null` so the existing form layout is
    // pixel-identical to before.
    recipeFields:
      !isEdit && isRecipeCatalog && selectedCatalog ? (
        <FormCardGrid title={t("endpoints.recipe.section", "Recipe options")}>
          {(() => {
            const verified = (
              selectedCatalog.metadata.annotations?.[
                "recipe.vllm.ai/hardware-verified"
              ] ?? ""
            )
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            if (verified.length === 0) return null;
            return (
              <div className="col-span-4 flex items-center gap-2 flex-wrap text-sm">
                <span className="text-muted-foreground">
                  {t("endpoints.recipe.verifiedOn", "Verified on:")}
                </span>
                {verified.map((hw) => (
                  <Badge
                    key={hw}
                    variant="outline"
                    className="border-green-600/40 text-green-700 dark:text-green-400"
                  >
                    ✓ {hw}
                  </Badge>
                ))}
              </div>
            );
          })()}
          <FormFieldGroup
            {...form}
            name="spec.variant"
            label={t("endpoints.recipe.variant", "Variant")}
            className="col-span-2"
          >
            <VariantPicker
              variants={selectedCatalog.spec.variants ?? {}}
              value={selectedVariant}
              onChange={handleVariantChange}
            />
          </FormFieldGroup>
          {(() => {
            const v =
              selectedCatalog.spec.variants?.[selectedVariant] ??
              selectedCatalog.spec.variants?.["default"];
            const req = v?.vram_minimum_gb ?? null;
            if (!req) return null;
            return (
              <div className="col-span-4">
                <VRAMCheckBadge
                  acceleratorProduct={
                    form.watch("spec.resources.accelerator")?.product
                  }
                  gpuCount={form.watch("spec.resources.gpu")}
                  requiredGb={req}
                />
              </div>
            );
          })()}
          {(estimatedTotalVramGb != null || activeModelInfo) && (
            <div className="col-span-4 rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 text-sm font-medium">
                {t("endpoints.recipe.resourceEstimate", "Resource estimate")}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {estimatedTotalVramGb != null && (
                  <div className="rounded-md border bg-background px-3 py-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      {t("endpoints.recipe.estimatedVram", "Estimated VRAM")}
                    </div>
                    <div className="mt-1 font-semibold tabular-nums">
                      ≈ {estimatedTotalVramGb} GB
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {activeVariantVram} GB ×{" "}
                      {t("endpoints.recipe.replicasCount", "{{count}} replica", {
                        count: replicaCount,
                      })}
                    </div>
                  </div>
                )}
                {activeModelInfo?.parameter_count && (
                  <div className="rounded-md border bg-background px-3 py-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      {t("model_catalogs.modelInfo.parameterCount", "Parameters")}
                    </div>
                    <div className="mt-1 font-semibold">
                      {activeModelInfo.parameter_count}
                    </div>
                  </div>
                )}
                {activeModelInfo?.quantization && (
                  <div className="rounded-md border bg-background px-3 py-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      {t("model_catalogs.modelInfo.quantization", "Quantization")}
                    </div>
                    <div className="mt-1 font-semibold">
                      {activeModelInfo.quantization}
                    </div>
                  </div>
                )}
                {activeModelInfo?.context_length && (
                  <div className="rounded-md border bg-background px-3 py-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      {t(
                        "model_catalogs.modelInfo.contextLength",
                        "Context length",
                      )}
                    </div>
                    <div className="mt-1 font-semibold">
                      {activeModelInfo.context_length}
                    </div>
                  </div>
                )}
                {activeModelInfo?.architecture && (
                  <div className="rounded-md border bg-background px-3 py-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      {t("model_catalogs.modelInfo.architecture", "Architecture")}
                    </div>
                    <div className="mt-1 font-semibold">
                      {activeModelInfo.architecture}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {selectedCatalog.spec.features &&
            Object.keys(selectedCatalog.spec.features).length > 0 && (
              <FormFieldGroup
                {...form}
                name="spec.feature_selections"
                label={t("endpoints.recipe.features", "Features")}
                className="col-span-4"
              >
                <FeaturePicker
                  features={selectedCatalog.spec.features ?? {}}
                  value={featureSelections}
                  onChange={handleFeaturesChange}
                />
              </FormFieldGroup>
            )}
          {showFull && (
            <div className="col-span-4">
              <ComposePreview
                composed={
                  composeResult && composeResult.ok ? composeResult.spec : null
                }
                error={
                  composeResult && !composeResult.ok ? composeResult.error : null
                }
              />
            </div>
          )}
        </FormCardGrid>
      ) : null,
    // Scheduling target and resource selection section - always visible.
    resourceFields: (
      <FormCardGrid title={t("endpoints.sections.schedulingTargetResources")}>
        <div
          data-testid="endpoint-resource-config-grid"
          className="col-span-4 space-y-4"
        >
          <section
            data-testid="endpoint-scheduling-target-card"
            className="w-full rounded-md border bg-background px-3 py-2"
          >
            <div className="grid gap-3 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)] xl:items-center">
              <div className="flex h-9 min-w-0 items-center">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold">
                    {t("endpoints.sections.schedulingTarget")}
                  </h3>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          aria-label={t(
                            "endpoints.descriptions.clusterSchedulingTarget",
                          )}
                          title={t(
                            "endpoints.descriptions.clusterSchedulingTarget",
                          )}
                        >
                          <CircleHelp className="size-3.5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="start"
                        className="max-w-xs leading-5"
                      >
                        {t("endpoints.descriptions.clusterSchedulingTarget")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-1 items-end justify-start gap-3 sm:grid-cols-[minmax(220px,280px)_max-content]">
                <FormFieldGroup
                  {...form}
                  name="spec.cluster"
                  label={t("common.fields.cluster")}
                  className="w-full max-w-[280px]"
                >
                  <FormCombobox
                    disabled={clusters.query.isLoading}
                    placeholder={t("endpoints.placeholders.selectCluster")}
                    options={(clusters.query?.data?.data || []).map((e) => {
                      return {
                        label: e.metadata.name,
                        value: e.metadata.name,
                      };
                    })}
                  />
                </FormFieldGroup>
                <div
                  data-testid="endpoint-scheduling-target-node-count"
                  className="flex h-9 min-w-[108px] items-center justify-between gap-2 rounded-md border bg-muted/20 px-3"
                >
                  <span className="text-[11px] font-medium leading-4 text-muted-foreground">
                    {t("endpoints.fields.nodeCount")}
                  </span>
                  <span className="text-sm font-semibold leading-5 text-foreground">
                    {selectedClusterNodeCountText}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <div
            data-testid="endpoint-resource-layout-grid"
            className={cn(
              "grid gap-3",
              showFull && currentCluster
                ? "xl:grid-cols-[minmax(360px,420px)_minmax(620px,1fr)]"
                : "xl:grid-cols-[minmax(360px,420px)]",
            )}
          >
            <div
              data-testid="endpoint-resource-config-main"
              className="min-w-0 xl:sticky xl:top-4"
            >
              <section
                data-testid="endpoint-resource-plan-card"
                className="grid overflow-hidden rounded-xl border bg-background shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 border-b p-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold">
                      {t("endpoints.sections.resourcePlan")}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("endpoints.descriptions.basicResources")}
                    </p>
                  </div>
                  {selectedAccelerator?.type &&
                    selectedAccelerator?.product && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 font-normal",
                          getCapacityBadgeClassName(
                            isVgpuAllocationMode
                              ? isVgpuCapacityExceeded
                              : isFullGpuCapacityExceeded,
                          ),
                        )}
                      >
                        {isVgpuAllocationMode
                          ? isVgpuCapacityExceeded
                            ? t("endpoints.messages.vgpuResourcesInsufficient")
                            : t("endpoints.fields.matchingGpuCards")
                          : isFullGpuCapacityExceeded
                            ? t(
                                "endpoints.messages.fullGpuResourcesInsufficient",
                              )
                            : t("endpoints.fields.matchingGpuCards")}
                      </Badge>
                    )}
                </div>
                <div
                  data-testid="endpoint-resource-request-grid"
                  className="grid grid-cols-1 content-start items-start gap-3 self-start p-4 sm:grid-cols-2"
                >
                  <div
                    data-testid="endpoint-basic-resource-card"
                    className="contents"
                  >
                    <FormFieldGroup
                      {...form}
                      name="spec.resources.cpu"
                      label={t("common.fields.cpu")}
                      className="col-span-1"
                    >
                      <NumberInput
                        value={formatInputNumber(normalizedResources?.cpu ?? 0)}
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

                    <FormFieldGroup
                      {...form}
                      name="spec.resources.memory"
                      label={t("endpoints.fields.memoryGb")}
                      className="col-span-1"
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
                      >
                        <FormCombobox
                          options={acceleratorOptions.map((opt) => ({
                            label: opt.label,
                            value: opt.value,
                          }))}
                          value={
                            selectedAccelerator?.type &&
                            selectedAccelerator?.product
                              ? `${selectedAccelerator.type}:${selectedAccelerator.product}`
                              : ""
                          }
                          onChange={(value) => {
                            // Parse "type:product" format
                            const selectedOption = acceleratorOptions.find(
                              (opt) => opt.value === value,
                            );
                            if (selectedOption) {
                              const currentVirtualization = form.getValues(
                                "spec.resources.accelerator.virtualization",
                              );
                              form.setValue("spec.resources.accelerator", {
                                type: selectedOption.type,
                                product: selectedOption.product,
                                ...(isSelectedClusterVgpuEnabled
                                  ? {
                                      virtualization:
                                        currentVirtualization || {},
                                    }
                                  : {}),
                              } satisfies ResourceSpec["accelerator"]);
                            } else {
                              form.setValue("spec.resources.accelerator", null);
                            }
                          }}
                          placeholder={t(
                            "endpoints.placeholders.selectAccelerator",
                          )}
                          disabled={
                            !currentCluster || acceleratorOptions.length === 0
                          }
                          emptyMessage={t(
                            "endpoints.messages.noAcceleratorsAvailable",
                          )}
                        />
                      </FormFieldGroup>
                    </div>

                    <FormFieldGroup
                      {...form}
                      name="spec.resources.gpu"
                      label={t(
                        isVgpuAllocationMode
                          ? "endpoints.fields.vgpuCount"
                          : "endpoints.fields.physicalGpuCount",
                      )}
                      className="col-span-1"
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
                        max={
                          isVgpuAllocationMode
                            ? Math.max(maxVirtualCardsPerReplica, gpuUsage)
                            : Math.max(maxAvailable.gpu.available, gpuUsage)
                        }
                        step={isVgpuAllocationMode ? 1 : gpuStep}
                        disabled={
                          !currentCluster ||
                          !selectedAccelerator?.type ||
                          !selectedAccelerator?.product
                        }
                        className="h-9"
                      />
                    </FormFieldGroup>

                    {showFull && (
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
                      >
                        <Input
                          type="number"
                          aria-label={t("endpoints.fields.singleCardMemory")}
                          value={vgpuMemoryGiBInputValue}
                          onChange={(event) =>
                            setSingleCardMemoryGiB(event.target.value)
                          }
                          min={0}
                          max={
                            selectedMemoryTotalMiB
                              ? Number(
                                  formatInputNumber(
                                    selectedMemoryTotalMiB / 1024,
                                  ),
                                )
                              : undefined
                          }
                          step={0.5}
                          disabled={!showVgpuFields}
                          placeholder="GiB"
                          className="h-9"
                        />
                      </FormFieldGroup>

                      <FormFieldGroup
                        {...form}
                        name="spec.resources.accelerator.virtualization.core_percent"
                        label={t("endpoints.fields.vgpuCoreLimit")}
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
                          disabled={!showVgpuFields}
                          placeholder={
                            showVgpuFields ? "0" : t("common.options.disabled")
                          }
                          className="h-9"
                        />
                      </FormFieldGroup>
                    </div>
                    )}
                  </div>

                  {showFull &&
                    selectedAccelerator?.type &&
                    selectedAccelerator?.product && (
                      <div
                        data-testid="endpoint-current-request-panel"
                        className="col-span-1 border-t bg-muted/40 p-3 text-sm sm:col-span-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">
                            {t("endpoints.sections.currentRequest")}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-normal",
                              getCapacityBadgeClassName(
                                isVgpuAllocationMode
                                  ? isVgpuCapacityExceeded
                                  : isFullGpuCapacityExceeded,
                              ),
                            )}
                          >
                            {t("endpoints.messages.cardsAvailable", {
                              count: isVgpuAllocationMode
                                ? totalVirtualCardCapacity
                                : fullGpuCardCapacity,
                            })}
                          </Badge>
                        </div>
                        <div
                          data-testid="endpoint-current-request-grid"
                          className="mt-2 grid gap-2 sm:grid-cols-4"
                        >
                          <div className="rounded-lg border bg-background px-3 py-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              {t("endpoints.fields.virtualCardCount")}
                            </div>
                            <div className="mt-1 font-semibold tabular-nums">
                              {isVgpuAllocationMode
                                ? `${formatOneDecimal(
                                    requestedVirtualCards,
                                  )} / ${formatOneDecimal(
                                    totalVirtualCardCapacity,
                                  )}`
                                : `${formatOneDecimal(
                                    requestedFullGpuCards,
                                  )} / ${formatOneDecimal(
                                    fullGpuCardCapacity,
                                  )}`}
                            </div>
                          </div>
                          <div className="rounded-lg border bg-background px-3 py-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              {t("endpoints.fields.vgpuMemoryCapacity")}
                            </div>
                            <div className="mt-1 font-semibold tabular-nums">
                              {isVgpuAllocationMode
                                ? `${formatOneDecimal(
                                    requestedVgpuMemoryMiB / 1024,
                                  )} / ${formatOneDecimal(
                                    availableVgpuMemoryMiB / 1024,
                                  )} GiB`
                                : "-"}
                            </div>
                          </div>
                          <div className="rounded-lg border bg-background px-3 py-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              {t("endpoints.fields.vgpuCoreCapacity")}
                            </div>
                            <div className="mt-1 font-semibold tabular-nums">
                              {isVgpuAllocationMode
                                ? vgpuCoreUnitsPerCard > 0
                                  ? `${formatOneDecimal(
                                      requestedVgpuCoreUnits,
                                    )} / ${formatOneDecimal(
                                      availableVgpuCoreUnits,
                                    )}`
                                  : t("endpoints.options.shared")
                                : "-"}
                            </div>
                          </div>
                          <div className="rounded-lg border bg-background px-3 py-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              {t("endpoints.fields.scheduling")}
                            </div>
                            <div className="mt-1 font-semibold">
                              {t("common.fields.cluster")}
                            </div>
                          </div>
                        </div>
                        {isVgpuAllocationMode
                          ? isVgpuCapacityExceeded && (
                              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive">
                                {t(
                                  "endpoints.messages.vgpuResourcesInsufficient",
                                )}
                              </div>
                            )
                          : isFullGpuCapacityExceeded && (
                              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive">
                                {t(
                                  "endpoints.messages.fullGpuResourcesInsufficient",
                                )}
                              </div>
                            )}
                      </div>
                    )}
                </div>
              </section>
            </div>
            {showFull && clusterGpuResourcesPanel && (
              <div
                data-testid="endpoint-resource-context"
                className="min-w-0 overflow-hidden rounded-xl border bg-background shadow-sm"
              >
                {clusterGpuResourcesPanel}
              </div>
            )}
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
    // Hidden in simplified mode until the user expands the advanced disclosure.
    customizeFields: showFull ? (
      <FormCardGrid title={t("endpoints.sections.advancedOptions")}>
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
    ) : null,
    // Simplified-mode banner + disclosure toggle. Null outside simplified mode so
    // the standard create/edit layouts are unaffected.
    advancedToggle: simplified ? (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-primary" />
          {t(
            "endpoints.simplified.autoConfigured",
            "Model, engine and resources are auto-configured from the selected variant.",
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced
            ? t("endpoints.simplified.hideAdvanced", "Hide advanced options")
            : t("endpoints.simplified.showAdvanced", "Show all options")}
          <ChevronDown
            className={cn(
              "ml-1 size-4 transition-transform",
              showAdvanced && "rotate-180",
            )}
          />
        </Button>
      </div>
    ) : null,
  };
};
