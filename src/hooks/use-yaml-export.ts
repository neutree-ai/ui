import { useState, useCallback, useMemo } from "react";
import * as yaml from "js-yaml";
import { useDataProvider, useResource } from "@refinedev/core";
import { useWorkspace } from "@/components/theme/hooks";
import { useTranslation } from "@/lib/i18n";
import type { Metadata } from "@/types";

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

export type ExportableResource = (typeof EXPORTABLE_RESOURCES)[number];

export interface ResourceEntity {
  id: string | number;
  metadata: Metadata;
  kind: string;
  api_version: string;
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

export interface ResourceType {
  type: ExportableResource;
  label: string;
  selected: boolean;
  entities: ResourceEntity[];
  selectedEntities: Set<string>;
  loaded: boolean;
}

export interface ExportOptions {
  removeStatus: boolean;
  removeIds: boolean;
  removeTimestamps: boolean;
}

export interface ExportProgress {
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
        label: "", // Will be updated when exportableResources changes
        selected: false,
        entities: [],
        selectedEntities: new Set(),
        loaded: false,
      };
    }
    return initial;
  });

  // Update labels when exportableResources changes
  useMemo(() => {
    setResourceTypes((prev) => {
      const updated = { ...prev };
      for (const resource of exportableResources) {
        if (updated[resource.type]) {
          updated[resource.type] = {
            ...updated[resource.type],
            label: resource.label,
          };
        }
      }
      return updated;
    });
  }, [exportableResources]);

  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    removeStatus: true,
    removeIds: true,
    removeTimestamps: true,
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

  // Load entities for a resource type
  const loadEntities = useCallback(
    async (type: ExportableResource) => {
      if (resourceTypes[type].loaded) return;
    
      // Set loading state for this resource
      setLoadingResources((prev) => new Set(prev).add(type));

      try {
        // Get the resource configuration from refine
        const resourceConfig = exportableResources.find((r) => r.type === type);
        const resourceMeta = resourceConfig?.meta || {};

        // Build meta object from resource configuration
        const meta: Record<string, unknown> = {
          ...resourceMeta,
        };

        // Add workspace context if the resource is workspaced
        if (resourceMeta.workspaced && currentWorkspace) {
          meta.workspace = currentWorkspace;
        }

        const result = await dataProvider().getList({
          resource: type,
          pagination: { mode: "off" as const },
          meta,
        });

        const entities = result.data.map((item: Record<string, unknown>) => ({
          id: item.id || (item.metadata as Metadata)?.name,
          metadata: item.metadata as Metadata,
          kind: item.kind as string,
          api_version: item.api_version as string,
          spec: item.spec as Record<string, unknown> | undefined,
          status: item.status as Record<string, unknown> | undefined,
        }));

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
        // Remove loading state for this resource
        setLoadingResources((prev) => {
          const updated = new Set(prev);
          updated.delete(type);
          return updated;
        });
      }
    },
    [dataProvider, currentWorkspace, resourceTypes, exportableResources],
  );

  // Transform entity to YAML format
  const transformEntityToYaml = useCallback(
    (entity: ResourceEntity, options: ExportOptions) => {
      const yamlEntity: Record<string, unknown> = {
        apiVersion: entity.api_version,
        kind: entity.kind,
        metadata: { ...entity.metadata },
      };

      if (entity.spec) {
        yamlEntity.spec = entity.spec;
      }

      if (entity.status && !options.removeStatus) {
        yamlEntity.status = entity.status;
      }

      // Remove timestamps if requested
      if (
        options.removeTimestamps &&
        yamlEntity.metadata &&
        typeof yamlEntity.metadata === "object"
      ) {
        const metadata = yamlEntity.metadata as Record<string, unknown>;
        delete metadata.creation_timestamp;
        delete metadata.update_timestamp;
        delete metadata.deletion_timestamp;
      }

      // Remove IDs if requested (but keep name)
      if (
        options.removeIds &&
        yamlEntity.metadata &&
        typeof yamlEntity.metadata === "object"
      ) {
        // Keep name but remove other auto-generated fields
        const metadata = yamlEntity.metadata as Record<string, unknown>;
        const { name, workspace, display_name, labels } = metadata as {
          name?: unknown;
          workspace?: unknown;
          display_name?: unknown;
          labels?: unknown;
          [key: string]: unknown;
        };

        yamlEntity.metadata = { name, workspace, display_name, labels };
      }

      return yamlEntity;
    },
    [],
  );

  // Generate YAML content
  const generateYamlContent = useCallback(async () => {
    setIsExporting(true);
    const selectedEntitiesData: Record<string, unknown>[] = [];
    let totalEntities = 0;
    let processedEntities = 0;

    // Count total selected entities
    for (const resourceType of Object.values(resourceTypes)) {
      totalEntities += resourceType.selectedEntities.size;
    }

    setExportProgress({ total: totalEntities, completed: 0 });

    try {
      for (const resourceType of Object.values(resourceTypes)) {
        if (resourceType.selectedEntities.size === 0) continue;

        setExportProgress((prev) => ({
          ...prev,
          currentResource: resourceType.label,
        }));

        for (const entityId of resourceType.selectedEntities) {
          const entity = resourceType.entities.find(
            (e) => String(e.id) === entityId,
          );
          if (entity) {
            const yamlEntity = transformEntityToYaml(entity, exportOptions);
            selectedEntitiesData.push(yamlEntity);
          }

          processedEntities++;
          setExportProgress((prev) => ({
            ...prev,
            completed: processedEntities,
          }));
        }
      }

      // Generate YAML content
      let yamlContent = "";
      for (let index = 0; index < selectedEntitiesData.length; index++) {
        const entity = selectedEntitiesData[index];
        if (index > 0) yamlContent += "\n---\n";
        yamlContent += yaml.dump(entity, {
          indent: 2,
          lineWidth: -1,
          noRefs: true,
          sortKeys: false,
          // Use replacer function to filter out null/undefined values
          replacer: (key: string, value: unknown) => {
            // Skip null and undefined values
            if (value === null || value === undefined) {
              return undefined; // This will omit the key from output
            }
            return value;
          },
        });
      }

      return yamlContent;
    } finally {
      setIsExporting(false);
      setExportProgress((prev) => ({ ...prev, currentResource: undefined }));
    }
  }, [resourceTypes, exportOptions, transformEntityToYaml]);

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
    const newResourceTypes = { ...resourceTypes };

    const resourcePromises = EXPORTABLE_RESOURCES.map(async (type) => {
        if (!newResourceTypes[type].loaded) {
          // Set loading state for this resource
          setLoadingResources((prev) => new Set(prev).add(type));

          try {
            const resourceConfig = exportableResources.find(
              (r) => r.type === type,
            );
            const resourceMeta = resourceConfig?.meta || {};

            const meta: Record<string, unknown> = {
              ...resourceMeta,
            };

            if (resourceMeta.workspaced && currentWorkspace) {
              meta.workspace = currentWorkspace;
            }

            const result = await dataProvider().getList({
              resource: type,
              pagination: { mode: "off" as const },
              meta,
            });

            const entities = result.data.map(
              (item: Record<string, unknown>) => ({
                id:
                  (item.id as string | number) ||
                  (item.metadata as Metadata)?.name ||
                  "",
                metadata: item.metadata as Metadata,
                kind: item.kind as string,
                api_version: item.api_version as string,
                spec: item.spec as Record<string, unknown> | undefined,
                status: item.status as Record<string, unknown> | undefined,
              }),
            );

            return {
              type,
              entities,
              success: true,
            };
          } catch (error) {
            console.error(`Failed to load entities for ${type}:`, error);
            return {
              type,
              entities: [],
              success: false,
            };
          } finally {
            // Remove loading state for this resource
            setLoadingResources((prev) => {
              const updated = new Set(prev);
              updated.delete(type);
              return updated;
            });
          }
        }
        
        // Return existing data if already loaded
        return {
          type,
          entities: newResourceTypes[type].entities,
          success: true,
        };
      });

    try {
      const results = await Promise.all(resourcePromises);

      results.forEach(({ type, entities, success }) => {
        if (success) {
          newResourceTypes[type] = {
            ...newResourceTypes[type],
            entities,
            loaded: true,
          };
        }
        
        // Select the resource type and all its entities
        newResourceTypes[type] = {
          ...newResourceTypes[type],
          selected: true,
          selectedEntities: new Set(
            newResourceTypes[type].entities.map((e) => String(e.id)),
          ),
        };
      });

      setResourceTypes(newResourceTypes);
    } finally {
      setIsSelectingAll(false);
    }
  }, [resourceTypes, exportableResources, dataProvider, currentWorkspace]);

  // Check if all resources are selected
  const areAllResourcesSelected = useMemo(() => {
    return EXPORTABLE_RESOURCES.every((type) => resourceTypes[type].selected);
  }, [resourceTypes]);

  return {
    resourceTypes,
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
  };
};
