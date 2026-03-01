import { useTranslation } from "@/foundation/lib/i18n";
import type { Metadata } from "@/foundation/types/basic-types";
import { useDataProvider, useResource } from "@refinedev/core";
import * as yaml from "js-yaml";
import { useCallback, useMemo, useState } from "react";
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

interface ResourceEntity {
  id: string | number;
  metadata: Metadata;
  kind: string;
  api_version: string;
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

interface ResourceType {
  type: ExportableResource;
  label: string;
  selected: boolean;
  entities: ResourceEntity[];
  selectedEntities: Set<string>;
  loaded: boolean;
}

interface ExportOptions {
  removeStatus: boolean;
  removeIds: boolean;
  removeTimestamps: boolean;
  includeCredentials: boolean;
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
      if (resourceTypes[type].loaded) return;

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
    [resourceTypes, fetchResourceEntities],
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

  // Transform entity to YAML format
  const transformEntityToYaml = useCallback(
    (entity: ResourceEntity, options: ExportOptions) => {
      const yamlEntity: Record<string, unknown> = {
        ...(options.removeIds ? {} : { id: entity.id }),
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
        const { name, workspace, display_name, labels, annotations } =
          metadata as {
            name?: unknown;
            workspace?: unknown;
            display_name?: unknown;
            labels?: unknown;
            annotations?: unknown;
            [key: string]: unknown;
          };

        yamlEntity.metadata = {
          name,
          workspace,
          display_name,
          labels,
          annotations,
        };
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
  }, [resourceTypes, fetchResourceEntities]);

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
    resetCredentialResources,
  };
};
