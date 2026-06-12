import { useCustom, useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import {
  type ComponentPropsWithoutRef,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Path, PathValue } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Combobox as AsyncCombobox } from "@/components/ui/combobox";
import { CommandLoading } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EndpointClusterGpuResourcesPanel,
  EndpointGpuResourceSummaryMetrics,
} from "@/domains/endpoint/components/EndpointClusterGpuResourcesPanel";
import { formatTaskName } from "@/domains/endpoint/components/ModelTask";
import { SliderWithInput } from "@/domains/endpoint/components/SliderWithInput";
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
import { FormSelect } from "@/foundation/components/FormSelect";
import { NumberInput } from "@/foundation/components/NumberInput";
import { VariablesInput } from "@/foundation/components/VariablesInput";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import type { Schema } from "@/foundation/hooks/use-variables-input";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import {
  buildGpuCardResourceRows,
  calculateVgpuSliceCapacity,
  countFullCardAvailableDevicesByProduct,
} from "@/foundation/lib/gpu-device-resources";

type AcceleratorVirtualization = NonNullable<
  ResourceSpec["accelerator"]
>["virtualization"];
type VgpuMemoryMode = "mib" | "gib" | "percent";
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

type NumberInputWithHintProps = ComponentPropsWithoutRef<typeof NumberInput> & {
  hint: string;
};

type ReadOnlyFieldDisplayProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "value"
> & {
  value: string;
  meta?: string;
};

const roundVgpuDisplayValue = (value: number) => Number(value.toFixed(2));

const getVgpuMemoryMiBFromMode = (
  mode: VgpuMemoryMode,
  value: number,
  memoryTotalMiB: number | null | undefined,
) => {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (mode === "mib") return value;
  if (mode === "gib") return Math.ceil(value * 1024);
  if (!memoryTotalMiB) return null;
  return Math.ceil((memoryTotalMiB * value) / 100);
};

const getVgpuMemoryValueForMode = (
  mode: VgpuMemoryMode,
  memoryMiB: number,
  memoryTotalMiB: number | null | undefined,
) => {
  if (mode === "mib") return memoryMiB;
  if (mode === "gib") return roundVgpuDisplayValue(memoryMiB / 1024);
  if (!memoryTotalMiB) return null;
  return Math.min(100, Math.ceil((memoryMiB * 100) / memoryTotalMiB));
};

const NumberInputWithHint = forwardRef<
  HTMLInputElement,
  NumberInputWithHintProps
>(({ hint, ...props }, ref) => (
  <div className="space-y-1">
    <NumberInput ref={ref} {...props} />
    <div className="text-xs text-muted-foreground">{hint}</div>
  </div>
));

NumberInputWithHint.displayName = "NumberInputWithHint";

const ReadOnlyFieldDisplay = forwardRef<
  HTMLDivElement,
  ReadOnlyFieldDisplayProps
>(({ value, meta, className, onChange: _onChange, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex h-9 items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 text-sm ${className ?? ""}`}
    {...props}
  >
    <span className="truncate font-medium">{value}</span>
    {meta && (
      <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
    )}
  </div>
));

ReadOnlyFieldDisplay.displayName = "ReadOnlyFieldDisplay";

export const useEndpointForm = ({ action }: { action: "create" | "edit" }) => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();
  const [selectedModelCatalog, setSelectedModelCatalog] = useState<string>("");
  const [modelSearch, setModelSearch] = useState("");
  const [vgpuMemoryMode, setVgpuMemoryMode] = useState<VgpuMemoryMode>("mib");
  const [gpuAllocationMode, setGpuAllocationMode] =
    useState<GpuAllocationMode>("full");
  const [isVgpuCoreLimitVisible, setIsVgpuCoreLimitVisible] = useState(false);
  const lastVgpuVirtualizationRef = useRef<{
    acceleratorKey: string;
    virtualization: AcceleratorVirtualization;
  } | null>(null);
  const hasUserSelectedGpuAllocationModeRef = useRef(false);

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

  const originalOnFinishRef = useRef(form.refineCore.onFinish);
  const syncedQueryResourcesKeyRef = useRef<string | null>(null);
  form.refineCore.onFinish = async (values) => {
    const transformedValues =
      typeof structuredClone === "function"
        ? structuredClone(values)
        : JSON.parse(JSON.stringify(values));
    transformEndpointValues((transformedValues as Endpoint).spec);
    return originalOnFinishRef.current(transformedValues);
  };

  const watchedFormValues = form.watch();
  const formValues = watchedFormValues ?? form.getValues();
  const watchedResources = formValues.spec?.resources;
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
  const selectedAcceleratorKey =
    selectedAccelerator?.type && selectedAccelerator?.product
      ? `${selectedAccelerator.type}:${selectedAccelerator.product}`
      : null;
  const cpuUsage = normalizedResources?.cpu || 0;
  const memoryUsage = normalizedResources?.memory || 0;
  const gpuUsage = normalizedResources?.gpu || 0;
  const replicaCount = Math.max(1, Number(formValues.spec?.replicas?.num || 1));

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
    dynamicAvailability,
    gpuStep,
  } = useEndpointClusterResources({
    currentCluster,
    clustersData: clusters.query.data?.data,
    selectedAccelerator,
    cpuUsage,
    memoryUsage,
    currentUsage,
    t,
  });

  const isEdit = action === "edit";

  const selectedVirtualization = selectedAccelerator?.virtualization;
  const hasConfiguredVirtualization = hasVgpuVirtualizationValues(
    selectedVirtualization,
  );
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
  const selectedMemoryTotalMiB = selectedAcceleratorOption?.memoryTotalMiB;
  const effectiveVgpuMemoryMiB = getEffectiveVgpuMemoryMiB(
    selectedVirtualization,
    selectedMemoryTotalMiB,
  );
  const vgpuMemoryInputValue =
    vgpuMemoryMode === "percent"
      ? selectedVirtualization?.memory_percent || 0
      : vgpuMemoryMode === "gib"
        ? roundVgpuDisplayValue(
            Number(selectedVirtualization?.memory_mib || 0) / 1024,
          )
        : selectedVirtualization?.memory_mib || 0;
  const vgpuMemoryInputMax =
    vgpuMemoryMode === "percent"
      ? 100
      : vgpuMemoryMode === "gib"
        ? selectedMemoryTotalMiB
          ? selectedMemoryTotalMiB / 1024
          : undefined
        : selectedMemoryTotalMiB || undefined;
  const effectiveGpuAllocationMode =
    showVgpuFields && gpuAllocationMode === "vgpu" ? "vgpu" : "full";
  const isVgpuAllocationMode = effectiveGpuAllocationMode === "vgpu";
  const vgpuCoreUnitsPerSlice = Number(
    selectedVirtualization?.core_percent || 0,
  );
  const vgpuSliceCapacity = useMemo(
    () =>
      calculateVgpuSliceCapacity(
        selectedCluster?.status?.resource_info?.node_resources,
        {
          selectedAccelerator,
          memoryMiBPerSlice: effectiveVgpuMemoryMiB,
          coreUnitsPerSlice: vgpuCoreUnitsPerSlice,
        },
      ),
    [
      selectedCluster?.status?.resource_info?.node_resources,
      selectedAccelerator,
      effectiveVgpuMemoryMiB,
      vgpuCoreUnitsPerSlice,
    ],
  );
  const requestedVgpuSlices = gpuUsage * replicaCount;
  const requestedFullGpuCards = gpuUsage * replicaCount;
  const requestedVgpuMemoryMiB = effectiveVgpuMemoryMiB
    ? requestedVgpuSlices * effectiveVgpuMemoryMiB
    : 0;
  const requestedVgpuCoreUnits = vgpuCoreUnitsPerSlice
    ? requestedVgpuSlices * vgpuCoreUnitsPerSlice
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
  const reusableVgpuSlices = effectiveVgpuMemoryMiB
    ? vgpuCoreUnitsPerSlice > 0
      ? Math.min(
          Math.floor(reusableVgpuMemoryMiB / effectiveVgpuMemoryMiB),
          Math.floor(reusableVgpuCoreUnits / vgpuCoreUnitsPerSlice),
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
  const totalVgpuSliceCapacity =
    vgpuSliceCapacity.totalSlices + reusableVgpuSlices;
  const maxVgpuPerReplica = Math.floor(totalVgpuSliceCapacity / replicaCount);
  const additionalVgpuSlices = Math.max(
    0,
    requestedVgpuSlices - reusableVgpuSlices,
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
      (additionalVgpuSlices > vgpuSliceCapacity.totalSlices ||
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
    if (!showVgpuFields && gpuAllocationMode !== "full") {
      setGpuAllocationMode("full");
    }
  }, [gpuAllocationMode, showVgpuFields]);

  useEffect(() => {
    if (!isVgpuAllocationMode && isVgpuCoreLimitVisible) {
      setIsVgpuCoreLimitVisible(false);
    }
  }, [isVgpuAllocationMode, isVgpuCoreLimitVisible]);

  useEffect(() => {
    if (
      isVgpuAllocationMode &&
      vgpuCoreUnitsPerSlice > 0 &&
      !isVgpuCoreLimitVisible
    ) {
      setIsVgpuCoreLimitVisible(true);
    }
  }, [isVgpuAllocationMode, isVgpuCoreLimitVisible, vgpuCoreUnitsPerSlice]);

  useEffect(() => {
    if (
      showVgpuFields &&
      hasConfiguredVirtualization &&
      gpuAllocationMode !== "vgpu" &&
      !hasUserSelectedGpuAllocationModeRef.current
    ) {
      setGpuAllocationMode("vgpu");
    }
  }, [gpuAllocationMode, hasConfiguredVirtualization, showVgpuFields]);

  useEffect(() => {
    hasUserSelectedGpuAllocationModeRef.current = false;
    if (!currentCluster && !selectedAcceleratorKey) {
      return;
    }
  }, [currentCluster, selectedAcceleratorKey]);

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

  const setVgpuMemoryValue = (value: number) => {
    if (vgpuMemoryMode === "percent") {
      form.setValue(
        "spec.resources.accelerator.virtualization.memory_percent",
        value,
        userSetValueOptions,
      );
      form.setValue(
        "spec.resources.accelerator.virtualization.memory_mib",
        undefined,
        userSetValueOptions,
      );
      return;
    }

    form.setValue(
      "spec.resources.accelerator.virtualization.memory_mib",
      vgpuMemoryMode === "gib" ? Math.ceil(value * 1024) : value,
      userSetValueOptions,
    );
    form.setValue(
      "spec.resources.accelerator.virtualization.memory_percent",
      undefined,
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

  // Handle model catalog selection with merge logic
  const handleModelCatalogSelect = (catalogId: string) => {
    setSelectedModelCatalog(catalogId);

    if (!catalogId) {
      applyCatalogSpec(null);
      return;
    }

    const selectedCatalog = modelCatalogs.query.data?.data.find(
      (catalog) => catalog.id.toString() === catalogId,
    );

    if (selectedCatalog) {
      applyCatalogSpec(selectedCatalog.spec as Record<string, unknown>);
    }
  };

  const handleGpuAllocationModeChange = (mode: GpuAllocationMode) => {
    hasUserSelectedGpuAllocationModeRef.current = true;
    setGpuAllocationMode(mode);
    const currentVirtualization = form.getValues(
      "spec.resources.accelerator.virtualization",
    );

    if (mode === "full") {
      if (
        selectedAcceleratorKey &&
        hasVgpuVirtualizationValues(currentVirtualization)
      ) {
        lastVgpuVirtualizationRef.current = {
          acceleratorKey: selectedAcceleratorKey,
          virtualization: currentVirtualization,
        };
      }
      form.setValue(
        "spec.resources.accelerator.virtualization",
        undefined,
        userSetValueOptions,
      );
      return;
    }

    if (hasVgpuVirtualizationValues(currentVirtualization)) {
      return;
    }

    const savedVirtualization =
      selectedAcceleratorKey &&
      lastVgpuVirtualizationRef.current?.acceleratorKey ===
        selectedAcceleratorKey
        ? lastVgpuVirtualizationRef.current.virtualization
        : undefined;
    if (hasVgpuVirtualizationValues(savedVirtualization)) {
      form.setValue(
        "spec.resources.accelerator.virtualization",
        savedVirtualization,
        userSetValueOptions,
      );
      return;
    }

    const defaultMemoryMiB = selectedMemoryTotalMiB
      ? Math.min(4096, selectedMemoryTotalMiB)
      : 4096;
    form.setValue(
      "spec.resources.accelerator.virtualization",
      {
        memory_mib: defaultMemoryMiB,
        core_percent: 0,
      },
      userSetValueOptions,
    );
  };

  const gpuCardResourceRows = useMemo(
    () =>
      buildGpuCardResourceRows(
        selectedCluster?.status?.resource_info,
        selectedAccelerator,
      ),
    [selectedCluster?.status?.resource_info, selectedAccelerator],
  );
  const selectedGpuCardResourceRows = useMemo(
    () =>
      selectedAccelerator?.product
        ? gpuCardResourceRows.filter((row) => row.matchesSelectedAccelerator)
        : gpuCardResourceRows,
    [gpuCardResourceRows, selectedAccelerator?.product],
  );

  const clusterGpuResourcesPanel = (
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
        requestedVgpuSlices,
        totalVgpuSliceCapacity,
        requestedVgpuMemoryMiB,
        availableVgpuMemoryMiB,
        requestedVgpuCoreUnits,
        availableVgpuCoreUnits,
        memoryMiBPerSlice: effectiveVgpuMemoryMiB,
        coreUnitsPerSlice: vgpuCoreUnitsPerSlice,
        vgpuCapacityExceeded: isVgpuCapacityExceeded,
      }}
      t={t}
    />
  );

  return {
    form,
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
          <FormFieldGroup
            {...form}
            name="spec.replicas.num"
            label={t("endpoints.fields.replicas")}
          >
            <Input type="number" min={1} />
          </FormFieldGroup>
        </FormCardGrid>

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
      </>
    ),
    // Scheduling target and resource selection section - always visible.
    resourceFields: (
      <FormCardGrid title={t("endpoints.sections.schedulingTargetResources")}>
        <div
          data-testid="endpoint-resource-config-grid"
          className="col-span-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]"
        >
          <div
            data-testid="endpoint-resource-config-main"
            className="min-w-0 space-y-4"
          >
            <section
              data-testid="endpoint-scheduling-target-card"
              className="rounded-md border bg-background p-4"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold">
                    {t("endpoints.sections.schedulingTarget")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("endpoints.descriptions.clusterSchedulingTarget")}
                  </p>
                </div>
                <div className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                  {t("endpoints.fields.replicas")}: {replicaCount}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 xs:grid-cols-1">
                <FormFieldGroup
                  {...form}
                  name="spec.cluster"
                  label={t("common.fields.cluster")}
                  className="col-span-1"
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

                <FormFieldGroup
                  {...form}
                  name="-scheduling-scope"
                  label={t("endpoints.fields.schedulingScope")}
                  className="col-span-1"
                >
                  <ReadOnlyFieldDisplay
                    value={t("endpoints.options.clusterScheduling")}
                    meta={t("endpoints.messages.clusterSchedulingOnly")}
                  />
                </FormFieldGroup>
              </div>
            </section>

            <section
              data-testid="endpoint-basic-resource-card"
              className="rounded-md border bg-background p-4"
            >
              <div className="mb-4">
                <h3 className="text-base font-semibold">
                  {t("endpoints.sections.basicResources")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("endpoints.descriptions.basicResources")}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-4 xs:grid-cols-1">
                <FormFieldGroup
                  {...form}
                  name="spec.resources.cpu"
                  label={t("common.fields.cpu")}
                  className="col-span-2"
                >
                  <SliderWithInput
                    value={normalizedResources?.cpu || 0}
                    onChange={(value) =>
                      form.setValue("spec.resources.cpu", value)
                    }
                    min={0}
                    max={maxAvailable.cpu.available}
                    step={0.1}
                    unit="cores"
                    disabled={!currentCluster}
                    remainingInfo={
                      maxAvailable.cpu.total > 0
                        ? {
                            remaining: dynamicAvailability.cpu,
                            total: maxAvailable.cpu.total,
                            label: t("endpoints.fields.remaining"),
                          }
                        : undefined
                    }
                  />
                </FormFieldGroup>

                <FormFieldGroup
                  {...form}
                  name="spec.resources.memory"
                  label={t("endpoints.fields.memoryGb")}
                  className="col-span-2"
                >
                  <SliderWithInput
                    value={normalizedResources?.memory || 0}
                    onChange={(value) =>
                      form.setValue("spec.resources.memory", value)
                    }
                    min={0}
                    max={maxAvailable.memory.available}
                    step={0.5}
                    unit="GiB"
                    disabled={!currentCluster}
                    remainingInfo={
                      maxAvailable.memory.total > 0
                        ? {
                            remaining: dynamicAvailability.memory,
                            total: maxAvailable.memory.total,
                            label: t("endpoints.fields.remaining"),
                          }
                        : undefined
                    }
                  />
                </FormFieldGroup>
              </div>
            </section>

            <section
              data-testid="endpoint-accelerator-resource-card"
              className="rounded-md border bg-background p-4"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold">
                    {t("endpoints.fields.accelerator")}
                  </h3>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {selectedAccelerator?.product
                      ? `${selectedAccelerator.product}${
                          selectedMemoryTotalMiB
                            ? ` · ${selectedMemoryTotalMiB} MiB`
                            : ""
                        }`
                      : t("endpoints.messages.noAcceleratorSelected")}
                  </p>
                </div>
                {selectedAccelerator?.product && (
                  <div className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    {t("clusters.fields.selected")}
                  </div>
                )}
              </div>
              {selectedCluster?.status?.resource_info && (
                <EndpointGpuResourceSummaryMetrics
                  rows={selectedGpuCardResourceRows}
                  virtualizationEnabled={isSelectedClusterVgpuEnabled}
                  t={t}
                  testId="endpoint-accelerator-resource-metrics"
                  className="mb-4"
                />
              )}
              <div className="grid grid-cols-4 content-start items-start gap-4 self-start xs:grid-cols-1">
                <div
                  data-testid="endpoint-accelerator-allocator-row"
                  className="col-span-4 grid items-end gap-4 md:grid-cols-[minmax(220px,280px)_auto]"
                >
                  {/* Accelerator Selector */}
                  <FormFieldGroup
                    {...form}
                    name="spec.resources.accelerator"
                    label={t("common.fields.acceleratorProduct")}
                    className="min-w-0"
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
                              ? { virtualization: currentVirtualization || {} }
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

                  {showVgpuFields && (
                    <FormFieldGroup
                      {...form}
                      name="-gpu-allocation-mode"
                      label={t("endpoints.fields.allocationMode")}
                      className="space-y-3 md:min-w-[220px]"
                    >
                      <div className="inline-flex rounded-md border bg-background p-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            effectiveGpuAllocationMode === "full"
                              ? "default"
                              : "ghost"
                          }
                          onClick={() => handleGpuAllocationModeChange("full")}
                        >
                          {t("endpoints.fields.fullGpu")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            effectiveGpuAllocationMode === "vgpu"
                              ? "default"
                              : "ghost"
                          }
                          onClick={() => handleGpuAllocationModeChange("vgpu")}
                        >
                          {t("endpoints.fields.vgpu")}
                        </Button>
                      </div>
                    </FormFieldGroup>
                  )}
                </div>

                {selectedAccelerator?.type &&
                  selectedAccelerator?.product &&
                  !isVgpuAllocationMode && (
                    <>
                      <FormFieldGroup
                        {...form}
                        name="spec.resources.gpu"
                        label={
                          showVgpuFields
                            ? t("endpoints.fields.physicalGpuCount")
                            : t("endpoints.fields.acceleratorCount")
                        }
                        className="col-span-1"
                      >
                        <SliderWithInput
                          value={gpuUsage}
                          onChange={(value) =>
                            form.setValue("spec.resources.gpu", value)
                          }
                          min={0}
                          max={Math.max(maxAvailable.gpu.available, gpuUsage)}
                          step={gpuStep}
                          disabled={!currentCluster}
                          remainingInfo={
                            maxAvailable.gpu.total > 0
                              ? {
                                  remaining:
                                    maxAvailable.gpu.available - gpuUsage,
                                  total: maxAvailable.gpu.total,
                                  label: t("endpoints.fields.remaining"),
                                }
                              : undefined
                          }
                        />
                      </FormFieldGroup>
                      <div className="col-span-4 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                          <div className="font-medium">
                            {t("endpoints.sections.currentRequest")}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-muted-foreground">
                            <span className="text-foreground">
                              {t("endpoints.fields.physicalGpu")}:{" "}
                              {requestedFullGpuCards} / {fullGpuCardCapacity}
                            </span>
                            <span>
                              {t("endpoints.fields.replicas")}: {replicaCount}
                            </span>
                            <span>
                              {t("endpoints.fields.perReplica")}: {gpuUsage}
                            </span>
                          </div>
                        </div>
                        {isFullGpuCapacityExceeded && (
                          <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive">
                            {t(
                              "endpoints.messages.fullGpuResourcesInsufficient",
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                {isVgpuAllocationMode && (
                  <>
                    <div
                      data-testid="endpoint-vgpu-primary-row"
                      className="col-span-4 grid gap-4 md:grid-cols-[minmax(130px,0.32fr)_minmax(160px,0.34fr)_minmax(160px,0.34fr)]"
                    >
                      <FormFieldGroup
                        {...form}
                        name="-vgpu-memory-mode"
                        label={t("endpoints.fields.vgpuMemoryMode")}
                      >
                        <FormSelect
                          value={vgpuMemoryMode}
                          onChange={(value) => {
                            const nextMode = value as VgpuMemoryMode;
                            const previousMemoryMiB =
                              getVgpuMemoryMiBFromMode(
                                vgpuMemoryMode,
                                vgpuMemoryInputValue,
                                selectedMemoryTotalMiB,
                              ) ?? effectiveVgpuMemoryMiB;
                            const nextValue =
                              previousMemoryMiB !== null
                                ? getVgpuMemoryValueForMode(
                                    nextMode,
                                    previousMemoryMiB,
                                    selectedMemoryTotalMiB,
                                  )
                                : null;
                            setVgpuMemoryMode(nextMode);
                            if (nextMode === "percent") {
                              form.setValue(
                                "spec.resources.accelerator.virtualization",
                                {
                                  ...(selectedVirtualization ?? {}),
                                  memory_mib: undefined,
                                  memory_percent: nextValue ?? undefined,
                                },
                                userSetValueOptions,
                              );
                            } else {
                              const nextMemoryMiB =
                                nextMode === "gib" && nextValue !== null
                                  ? Math.ceil(nextValue * 1024)
                                  : nextValue;
                              form.setValue(
                                "spec.resources.accelerator.virtualization",
                                {
                                  ...(selectedVirtualization ?? {}),
                                  memory_mib: nextMemoryMiB ?? undefined,
                                  memory_percent: undefined,
                                },
                                userSetValueOptions,
                              );
                            }
                          }}
                          options={[
                            { label: t("endpoints.options.mib"), value: "mib" },
                            { label: t("endpoints.options.gib"), value: "gib" },
                            {
                              label: t("endpoints.options.percent"),
                              value: "percent",
                            },
                          ]}
                        />
                      </FormFieldGroup>

                      <FormFieldGroup
                        {...form}
                        name={
                          vgpuMemoryMode === "percent"
                            ? "spec.resources.accelerator.virtualization.memory_percent"
                            : "spec.resources.accelerator.virtualization.memory_mib"
                        }
                        label={
                          vgpuMemoryMode === "percent"
                            ? t("endpoints.fields.vgpuMemoryPercent")
                            : t("endpoints.fields.vgpuMemory")
                        }
                      >
                        <NumberInputWithHint
                          key={vgpuMemoryMode}
                          value={vgpuMemoryInputValue}
                          onValueChange={setVgpuMemoryValue}
                          min={1}
                          max={vgpuMemoryInputMax}
                          step={vgpuMemoryMode === "gib" ? 0.5 : 1}
                          hint={`${t("endpoints.fields.singleCardMemory")}: ${
                            selectedMemoryTotalMiB
                              ? `${selectedMemoryTotalMiB} MiB`
                              : "-"
                          }`}
                        />
                      </FormFieldGroup>

                      <FormFieldGroup
                        {...form}
                        name="spec.resources.gpu"
                        label={t("endpoints.fields.vgpuCount")}
                      >
                        <SliderWithInput
                          value={gpuUsage}
                          onChange={(value) =>
                            form.setValue("spec.resources.gpu", value)
                          }
                          min={0}
                          max={Math.max(maxVgpuPerReplica, gpuUsage)}
                          step={1}
                          disabled={!currentCluster}
                          remainingInfo={{
                            remaining: maxVgpuPerReplica - gpuUsage,
                            total: maxVgpuPerReplica,
                            label: t("endpoints.fields.remaining"),
                          }}
                        />
                      </FormFieldGroup>
                    </div>

                    <div
                      data-testid="endpoint-vgpu-core-row"
                      className="col-span-4 grid items-end gap-4 md:grid-cols-[minmax(130px,0.32fr)_minmax(160px,0.34fr)_minmax(160px,0.34fr)]"
                    >
                      <div
                        className="space-y-2"
                        data-testid="vgpu-core-limit-field"
                      >
                        <div className="flex min-h-[18px] items-center justify-between gap-3 text-sm font-medium leading-none">
                          <span>{t("endpoints.fields.vgpuCoreLimit")}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {t("endpoints.descriptions.vgpuCorePercentZero")}
                          </span>
                        </div>
                        <Select
                          value={
                            isVgpuCoreLimitVisible ? "enabled" : "disabled"
                          }
                          onValueChange={(value) => {
                            const enabled = value === "enabled";
                            setIsVgpuCoreLimitVisible(enabled);
                            if (!enabled) {
                              form.setValue(
                                "spec.resources.accelerator.virtualization.core_percent",
                                0,
                                userSetValueOptions,
                              );
                            }
                          }}
                        >
                          <SelectTrigger
                            aria-label={t("endpoints.fields.vgpuCoreLimit")}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disabled">
                              {t("common.options.disabled")}
                            </SelectItem>
                            <SelectItem value="enabled">
                              {t("common.options.enabled")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {isVgpuCoreLimitVisible && (
                        <div className="space-y-2">
                          <div className="flex min-h-[18px] items-center justify-between gap-3 text-sm font-medium leading-none">
                            <span>{t("endpoints.fields.vgpuCorePercent")}</span>
                            <span className="text-xs font-normal text-muted-foreground">
                              %
                            </span>
                          </div>
                          <NumberInput
                            aria-label={t("endpoints.fields.vgpuCorePercent")}
                            value={selectedVirtualization?.core_percent || 0}
                            onValueChange={(value) =>
                              form.setValue(
                                "spec.resources.accelerator.virtualization.core_percent",
                                value,
                                userSetValueOptions,
                              )
                            }
                            min={0}
                            max={100}
                            step={1}
                          />
                        </div>
                      )}
                    </div>

                    <div className="col-span-4 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="font-medium">
                          {t("endpoints.sections.currentRequest")}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-muted-foreground">
                          <span className="text-foreground">
                            {t("endpoints.fields.vgpuSlices")}:{" "}
                            {requestedVgpuSlices} / {totalVgpuSliceCapacity}
                          </span>
                          <span>
                            <span>
                              {t("endpoints.fields.vgpuMemoryCapacity")}
                            </span>
                            :{" "}
                            {availableVgpuMemoryMiB
                              ? `${requestedVgpuMemoryMiB} / ${availableVgpuMemoryMiB} MiB`
                              : "-"}
                          </span>
                          <span>
                            <span>
                              {t("endpoints.fields.vgpuCoreCapacity")}
                            </span>
                            :{" "}
                            {availableVgpuCoreUnits
                              ? `${requestedVgpuCoreUnits} / ${availableVgpuCoreUnits}`
                              : "-"}
                          </span>
                        </div>
                      </div>
                      {isVgpuCapacityExceeded && (
                        <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive">
                          {t("endpoints.messages.vgpuResourcesInsufficient")}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
          <div
            data-testid="endpoint-resource-context"
            className="min-w-0 xl:sticky xl:top-4"
          >
            {clusterGpuResourcesPanel}
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
    ),
  };
};
