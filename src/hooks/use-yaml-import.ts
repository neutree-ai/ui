import { useWorkspace } from "@/components/theme/hooks";
import { useTranslation } from "@/lib/i18n";
import { getResourcePlural } from "@/lib/plural";
import type { Metadata } from "@/types";
import { useCreate, useDataProvider } from "@refinedev/core";
import * as yaml from "js-yaml";
import { useCallback, useState } from "react";

interface YamlResource {
  apiVersion: string;
  kind: string;
  metadata: Metadata;
  spec: Record<string, unknown>;
}

interface ImportResult {
  resourceName: string;
  resourceType: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

interface ImportProgress {
  total: number;
  completed: number;
  currentResource?: string;
  results: ImportResult[];
}

export const useYamlImport = () => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<ImportProgress>({
    total: 0,
    completed: 0,
    results: [],
  });
  const [isImporting, setIsImporting] = useState(false);

  const { current: currentWorkspace } = useWorkspace();
  const { mutateAsync: createResource } = useCreate();
  const dataProvider = useDataProvider();

  // Check if a resource already exists
  const checkResourceExists = useCallback(
    async (
      resourceType: string,
      resourceName: string,
      workspace: string,
    ): Promise<boolean> => {
      try {
        const result = await dataProvider().getOne({
          resource: resourceType,
          id: resourceName,
          meta: {
            workspace,
            idColumnName: "metadata->name",
            workspaced: true,
          },
        });
        return !!result.data;
      } catch (error) {
        // If getOne throws an error, it likely means the resource doesn't exist
        return false;
      }
    },
    [dataProvider],
  );

  // Auto-generate resource type from kind using naming convention
  const getResourceType = useCallback((kind: string): string => {
    // Convert PascalCase kind to snake_case resource type
    // e.g., ModelRegistry -> model_registry, Cluster -> cluster
    const snakeCase = kind
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .substring(1); // Remove leading underscore

    // Split into words and pluralize each word that needs pluralization
    // For compound words like "model_registry", we only pluralize the last word
    const parts = snakeCase.split("_");
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      const pluralizedLastPart = getResourcePlural(lastPart);
      parts[parts.length - 1] = pluralizedLastPart;
    }

    return parts.join("_");
  }, []);

  const transformResourceForAPI = useCallback(
    (resource: YamlResource, resourceType: string): Record<string, unknown> => {
      // Use workspace from YAML if provided, otherwise use current workspace
      const workspaceToUse = resource.metadata.workspace || currentWorkspace;

      // Transform the Kubernetes-style resource to match our API expectations
      const baseResource = {
        api_version: resource.apiVersion,
        kind: resource.kind,
        metadata: {
          ...resource.metadata,
          workspace: workspaceToUse,
          labels: resource.metadata.labels || {},
        },
        spec: resource.spec,
      };

      return baseResource;
    },
    [currentWorkspace],
  );

  const parseYamlContent = useCallback(
    (content: string): YamlResource[] => {
      const resources: YamlResource[] = [];

      try {
        // Use yaml.loadAll to handle multi-document YAML automatically
        yaml.loadAll(content, (doc) => {
          if (
            doc &&
            typeof doc === "object" &&
            "apiVersion" in doc &&
            "kind" in doc
          ) {
            resources.push(doc as YamlResource);
          }
        });
      } catch (error) {
        console.error(
          t("components.yamlImport.errors.processingYamlContent"),
          error,
        );
      }

      return resources;
    },
    [t],
  );

  const importFromYaml = useCallback(
    async (yamlContent: string): Promise<ImportProgress> => {
      setIsImporting(true);

      const newProgress: ImportProgress = {
        total: 0,
        completed: 0,
        results: [],
      };

      try {
        // Parse YAML content
        const resources = parseYamlContent(yamlContent);

        // Validate resources
        const validResources = resources.filter((resource) => {
          if (
            !resource.apiVersion ||
            !resource.kind ||
            !resource.metadata?.name
          ) {
            console.warn(
              t("components.yamlImport.errors.invalidResourceStructure"),
              resource,
            );
            return false;
          }
          // Since we now auto-generate resource types, all valid structures are supported
          return true;
        });

        newProgress.total = validResources.length;
        setProgress({ ...newProgress });

        // Process each resource
        for (const resource of validResources) {
          const resourceType = getResourceType(resource.kind);

          newProgress.currentResource = resource.metadata.name;
          setProgress({ ...newProgress });

          try {
            // Use workspace from resource metadata if available
            const workspaceForMeta =
              resource.metadata.workspace || currentWorkspace;

            // Check if resource already exists
            const resourceExists = await checkResourceExists(
              resourceType,
              resource.metadata.name,
              workspaceForMeta,
            );

            if (resourceExists) {
              // Resource already exists, skip it
              newProgress.results.push({
                resourceName: resource.metadata.name,
                resourceType: resourceType,
                success: true,
                skipped: true,
              });
            } else {
              // Resource doesn't exist, create it
              const transformedResource = transformResourceForAPI(
                resource,
                resourceType,
              );

              await createResource({
                resource: resourceType,
                values: transformedResource,
                meta: {
                  workspace: workspaceForMeta,
                  idColumnName: "metadata->name",
                  workspaced: true,
                },
              });

              newProgress.results.push({
                resourceName: resource.metadata.name,
                resourceType: resourceType,
                success: true,
                skipped: false,
              });
            }
          } catch (error) {
            console.error(
              t("components.yamlImport.errors.creatingResource", {
                resourceType,
                resourceName: resource.metadata.name,
              }),
              error,
            );

            newProgress.results.push({
              resourceName: resource.metadata.name,
              resourceType: resourceType,
              success: false,
              skipped: false,
              error:
                typeof error === "object" &&
                error !== null &&
                "message" in error
                  ? String(error.message)
                  : t("components.yamlImport.errors.unknownError"),
            });
          }

          newProgress.completed++;
          newProgress.currentResource = undefined;
          setProgress({ ...newProgress });
        }
      } catch (error) {
        console.error(
          t("components.yamlImport.errors.duringYamlImport"),
          error,
        );
      } finally {
        setIsImporting(false);
      }

      return newProgress;
    },
    [
      parseYamlContent,
      getResourceType,
      transformResourceForAPI,
      checkResourceExists,
      createResource,
      currentWorkspace,
      t,
    ],
  );

  const importFromFile = useCallback(
    async (file: File): Promise<ImportProgress> => {
      try {
        const content = await file.text();
        return await importFromYaml(content);
      } catch (error) {
        console.error(t("components.yamlImport.errors.readingFile"), error);
        setIsImporting(false);
        return {
          total: 0,
          completed: 0,
          results: [
            {
              resourceName: file.name,
              resourceType: "file",
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : t("components.yamlImport.errors.failedToReadFile"),
            },
          ],
        };
      }
    },
    [importFromYaml, t],
  );

  const importFromUrl = useCallback(
    async (url: string): Promise<ImportProgress> => {
      try {
        setIsImporting(true);

        // Validate URL format
        let normalizedUrl = url.trim();
        if (
          !normalizedUrl.startsWith("http://") &&
          !normalizedUrl.startsWith("https://")
        ) {
          normalizedUrl = `https://${normalizedUrl}`;
        }

        const response = await fetch(normalizedUrl, {
          method: "GET",
          headers: {
            Accept: "application/x-yaml, text/yaml, text/plain, */*",
          },
        });

        if (!response.ok) {
          throw new Error(
            t("components.yamlImport.errors.failedToFetchFromUrl", {
              status: response.status,
              statusText: response.statusText,
            }),
          );
        }

        const content = await response.text();
        return await importFromYaml(content);
      } catch (error) {
        console.error(
          t("components.yamlImport.errors.fetchingYamlFromUrl"),
          error,
        );
        setIsImporting(false);
        return {
          total: 0,
          completed: 0,
          results: [
            {
              resourceName: url,
              resourceType: "url",
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : t("components.yamlImport.errors.failedToFetchFromUrl"),
            },
          ],
        };
      }
    },
    [importFromYaml, t],
  );

  const resetProgress = useCallback(() => {
    setProgress({
      total: 0,
      completed: 0,
      results: [],
    });
  }, []);

  return {
    progress,
    isImporting,
    importFromYaml,
    importFromFile,
    importFromUrl,
    resetProgress,
  };
};
