import { useTranslation } from "@/foundation/lib/i18n";
import {
  serializeToYaml,
  transformEntityForExport,
} from "@/foundation/lib/yaml-transform";
import type {
  ExportOptions,
  ResourceEntity,
} from "@/foundation/lib/yaml-transform";
import type { Metadata } from "@/foundation/types/basic-types";
import { useDataProvider, useResource } from "@refinedev/core";
import { useCallback, useMemo, useRef, useState } from "react";
import { ALL_WORKSPACES, useWorkspace } from "./use-workspace";

// Available resource types for export
export const EXPORTABLE_RESOURCES = [
  "clusters",
  "endpoints",
  "engines",
  "image_registries",
  "model_registries",
  "model_catalogs",
  "api_keys",
  "roles",
  "role_assignments",
  "workspaces",
] as const;

// Resources that support credentials API for sensitive field export
const CREDENTIAL_RESOURCES = [
  "clusters",
  "image_registries",
  "model_registries",
] as const;

export type ExportableResource = (typeof EXPORTABLE_RESOURCES)[number];

interface ResourceType {
  type: ExportableResource;
  label: string;
  selected: boolean;
  entities: ResourceEntity[];
  selectedEntities: Set<string>;
  loaded: boolean;
}

interface ExportProgress {
  total: number;
  completed: number;
  currentResource?: string;
}

export const useYamlExport = () => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();
  const dataProvider = useDataProvider();
  const { resources } = useResource();

  // Filter exportable resources from all configured resources
  const exportableResources = useMemo(() => {
    return resources
      .filter((resource) =>
        EXPORTABLE_RESOURCES.includes(resource.name as ExportableResource),
      )
      .map((resource) => ({
        type: resource.name as ExportableResource,
        label: t(`${resource.name}.title`),
        meta: resource.meta || {},
      }));
  }, [resources, t]);

  const [resourceTypes, setResourceTypes] = useState<
    Record<ExportableResource, ResourceType>
  >(() => {
    const initial: Record<ExportableResource, ResourceType> = {} as Record<
      ExportableResource,
      ResourceType
    >;
    for (const type of EXPORTABLE_RESOURCES) {
      initial[type] = {
        type,
        label: "",
        selected: false,
        entities: [],
        selectedEntities: new Set(),
        loaded: false,
      };
    }
    return initial;
  });

  // Derive labels from exportableResources (pure memo, no side effects)
  const labelMap = useMemo(() => {
    const map: Partial<Record<ExportableResource, string>> = {};
    for (const r of exportableResources) {
      map[r.type] = r.label;
    }
    return map;
  }, [exportableResources]);

  // Ref mirror for reading resourceTypes in async callbacks without stale closures
  const resourceTypesRef = useRef(resourceTypes);
  resourceTypesRef.current = resourceTypes;

  // Merge labels at return boundary
  const resourceTypesWithLabels = useMemo(() => {
    const result = { ...resourceTypes };
    for (const key of EXPORTABLE_RESOURCES) {
      result[key] = { ...result[key], label: labelMap[key] || "" };
    }
    return result;
  }, [resourceTypes, labelMap]);

  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    removeStatus: true,
    removeIds: true,
    removeTimestamps: true,
    includeCredentials: true,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    total: 0,
    completed: 0,
  });
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const [loadingResources, setLoadingResources] = useState<
    Set<ExportableResource>
  >(new Set());

  // Toggle resource type selection
  const toggleResourceType = useCallback((type: ExportableResource) => {
    setResourceTypes((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        selected: !prev[type].selected,
        selectedEntities: !prev[type].selected
          ? new Set(prev[type].entities.map((e) => String(e.id)))
          : new Set(),
      },
    }));
  }, []);

  // Toggle entity selection
  const toggleEntity = useCallback(
    (type: ExportableResource, entityId: string) => {
      setResourceTypes((prev) => {
        const newSelectedEntities = new Set(prev[type].selectedEntities);
        if (newSelectedEntities.has(entityId)) {
          newSelectedEntities.delete(entityId);
        } else {
          newSelectedEntities.add(entityId);
        }

        return {
          ...prev,
          [type]: {
            ...prev[type],
            selectedEntities: newSelectedEntities,
            selected: newSelectedEntities.size > 0,
          },
        };
      });
    },
    [],
  );

  // Fetch entities for a resource type from API
  const fetchResourceEntities = useCallback(
    async (type: ExportableResource): Promise<ResourceEntity[]> => {
      const resourceConfig = exportableResources.find((r) => r.type === type);
      const resourceMeta = resourceConfig?.meta || {};

      const useCredentialsApi =
        exportOptions.includeCredentials &&
        CREDENTIAL_RESOURCES.includes(
          type as (typeof CREDENTIAL_RESOURCES)[number],
        );

      let data: Record<string, unknown>[];

      if (useCredentialsApi) {
        const params = new URLSearchParams();
        if (
          resourceMeta.workspaced &&
          currentWorkspace &&
          currentWorkspace !== ALL_WORKSPACES
        ) {
          params.append(
            "metadata->workspace",
            `eq.${JSON.stringify(currentWorkspace)}`,
          );
        }
        const queryString = params.toString();
        const url = `/credentials/${type}${queryString ? `?${queryString}` : ""}`;

        // biome-ignore lint/style/noNonNullAssertion: we defined custom method in data provider
        const result = await dataProvider().custom!({
          url,
          method: "get",
        });
        data = Array.isArray(result.data) ? result.data : [];
      } else {
        const meta: Record<string, unknown> = {
          ...resourceMeta,
        };

        if (
          resourceMeta.workspaced &&
          currentWorkspace &&
          currentWorkspace !== ALL_WORKSPACES
        ) {
          meta.workspace = currentWorkspace;
        }

        const result = await dataProvider().getList({
          resource: type,
          pagination: { mode: "off" as const },
          meta,
        });
        data = result.data;
      }

      return data.map((item: Record<string, unknown>) => ({
        id:
          (item.id as string | number) ||
          (item.metadata as Metadata)?.name ||
          "",
        metadata: item.metadata as Metadata,
        kind: item.kind as string,
        api_version: item.api_version as string,
        spec: item.spec as Record<string, unknown> | undefined,
        status: item.status as Record<string, unknown> | undefined,
      }));
    },
    [
      dataProvider,
      currentWorkspace,
      exportableResources,
      exportOptions.includeCredentials,
    ],
  );

  // Load entities for a resource type
  const loadEntities = useCallback(
    async (type: ExportableResource) => {
      if (resourceTypesRef.current[type].loaded) return;

      setLoadingResources((prev) => new Set(prev).add(type));

      try {
        const entities = await fetchResourceEntities(type);

        setResourceTypes((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            entities,
            loaded: true,
          },
        }));
      } catch (error) {
        console.error(`Failed to load entities for ${type}:`, error);
      } finally {
        setLoadingResources((prev) => {
          const updated = new Set(prev);
          updated.delete(type);
          return updated;
        });
      }
    },
    [fetchResourceEntities],
  );

  // Reset credential resources when includeCredentials changes
  // User needs to re-select resources, but this is acceptable since it's a rare operation
  const resetCredentialResources = useCallback(() => {
    setResourceTypes((prev) => {
      const updated = { ...prev };
      for (const type of CREDENTIAL_RESOURCES) {
        if (updated[type].loaded) {
          updated[type] = {
            ...updated[type],
            selected: false,
            loaded: false,
            entities: [],
            selectedEntities: new Set(),
          };
        }
      }
      return updated;
    });
  }, []);

  // Generate YAML content
  const generateYamlContent = useCallback(async () => {
    setIsExporting(true);
    const currentResourceTypes = resourceTypesRef.current;
    const selectedEntitiesData: Record<string, unknown>[] = [];
    let totalEntities = 0;
    let processedEntities = 0;

    // Count total selected entities
    for (const resourceType of Object.values(currentResourceTypes)) {
      totalEntities += resourceType.selectedEntities.size;
    }

    setExportProgress({ total: totalEntities, completed: 0 });

    try {
      for (const type of EXPORTABLE_RESOURCES) {
        const resourceType = currentResourceTypes[type];
        if (resourceType.selectedEntities.size === 0) continue;

        setExportProgress((prev) => ({
          ...prev,
          currentResource: labelMap[type] || type,
        }));

        for (const entityId of resourceType.selectedEntities) {
          const entity = resourceType.entities.find(
            (e) => String(e.id) === entityId,
          );
          if (entity) {
            selectedEntitiesData.push(
              transformEntityForExport(entity, exportOptions),
            );
          }

          processedEntities++;
          setExportProgress((prev) => ({
            ...prev,
            completed: processedEntities,
          }));
        }
      }

      return serializeToYaml(selectedEntitiesData);
    } finally {
      setIsExporting(false);
      setExportProgress((prev) => ({ ...prev, currentResource: undefined }));
    }
  }, [labelMap, exportOptions]);

  // Statistics
  const statistics = useMemo(() => {
    const selectedResourceTypes = Object.values(resourceTypes).filter(
      (rt) => rt.selected,
    ).length;
    const totalSelectedEntities = Object.values(resourceTypes).reduce(
      (total, rt) => total + rt.selectedEntities.size,
      0,
    );
    return { selectedResourceTypes, totalSelectedEntities };
  }, [resourceTypes]);

  // Reset selections
  const resetSelections = useCallback(() => {
    setResourceTypes((prev) => {
      const reset = { ...prev };
      for (const key of Object.keys(reset)) {
        reset[key as ExportableResource] = {
          ...reset[key as ExportableResource],
          selected: false,
          selectedEntities: new Set(),
        };
      }
      return reset;
    });
  }, []);

  // Select all available resources
  const selectAllResources = useCallback(async () => {
    setIsSelectingAll(true);

    const resourcePromises = EXPORTABLE_RESOURCES.map(async (type) => {
      if (!resourceTypesRef.current[type].loaded) {
        setLoadingResources((prev) => new Set(prev).add(type));

        try {
          const entities = await fetchResourceEntities(type);
          return { type, entities, success: true };
        } catch (error) {
          console.error(`Failed to load entities for ${type}:`, error);
          return { type, entities: [] as ResourceEntity[], success: false };
        } finally {
          setLoadingResources((prev) => {
            const updated = new Set(prev);
            updated.delete(type);
            return updated;
          });
        }
      }

      return {
        type,
        entities: resourceTypesRef.current[type].entities,
        success: true,
      };
    });

    try {
      const results = await Promise.all(resourcePromises);

      setResourceTypes((prev) => {
        const updated = { ...prev };
        for (const { type, entities, success } of results) {
          if (success) {
            updated[type] = { ...updated[type], entities, loaded: true };
          }
          updated[type] = {
            ...updated[type],
            selected: true,
            selectedEntities: new Set(
              updated[type].entities.map((e) => String(e.id)),
            ),
          };
        }
        return updated;
      });
    } finally {
      setIsSelectingAll(false);
    }
  }, [fetchResourceEntities]);

  // Check if all resources are selected
  const areAllResourcesSelected = useMemo(() => {
    return EXPORTABLE_RESOURCES.every((type) => resourceTypes[type].selected);
  }, [resourceTypes]);

  return {
    resourceTypes: resourceTypesWithLabels,
    exportOptions,
    isExporting,
    exportProgress,
    statistics,
    areAllResourcesSelected,
    isSelectingAll,
    loadingResources,
    setResourceTypes,
    toggleResourceType,
    toggleEntity,
    loadEntities,
    setExportOptions,
    generateYamlContent,
    resetSelections,
    selectAllResources,
    resetCredentialResources,
  };
};
