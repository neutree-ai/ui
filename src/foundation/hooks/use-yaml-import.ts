import { useTranslation } from "@/foundation/lib/i18n";
import {
  isValidYamlResource,
  kindToResourceType,
  parseYamlDocuments,
  transformResourceForImport,
} from "@/foundation/lib/yaml-transform";
import { useCreate, useDataProvider, useResource } from "@refinedev/core";
import { useCallback, useState } from "react";
import { useWorkspace } from "./use-workspace";

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
  const { resources: resourcesConfigs } = useResource();

  // Check if a resource already exists
  const checkResourceExists = useCallback(
    async (
      resourceType: string,
      resourceName: string,
      workspace: string,
      isWorkspaced: boolean,
    ): Promise<boolean> => {
      try {
        const meta: Record<string, unknown> = {
          idColumnName: "metadata->name",
        };

        // Only add workspace filtering if the resource is workspace-scoped
        if (isWorkspaced) {
          meta.workspace = workspace;
          meta.workspaced = true;
        }

        const result = await dataProvider().getOne({
          resource: resourceType,
          id: resourceName,
          meta,
        });
        return !!result.data;
      } catch {
        // If getOne throws an error, it likely means the resource doesn't exist
        return false;
      }
    },
    [dataProvider],
  );

  const importFromYaml = useCallback(
    async (yamlContent: string): Promise<void> => {
      setIsImporting(true);

      const newProgress: ImportProgress = {
        total: 0,
        completed: 0,
        results: [],
      };

      try {
        // Parse YAML content
        const resources = parseYamlDocuments(yamlContent);

        // Validate resources
        const validResources = resources.filter((resource) => {
          if (!isValidYamlResource(resource)) {
            console.warn(
              t("components.yamlImport.errors.invalidResourceStructure"),
              resource,
            );
            return false;
          }
          return true;
        });

        newProgress.total = validResources.length;
        setProgress({ ...newProgress });

        // Process each resource
        for (const resource of validResources) {
          const resourceType = kindToResourceType(resource.kind);

          newProgress.currentResource = resource.metadata.name;
          setProgress({ ...newProgress });

          try {
            // Use workspace from resource metadata if available
            const workspaceForMeta =
              resource.metadata.workspace || currentWorkspace;

            // Get resource configuration to determine if it's workspace-scoped
            const resourceConfig = resourcesConfigs.find(
              (r) => r.name === resourceType,
            );
            const isWorkspaced = resourceConfig?.meta?.workspaced || false;

            // Check if resource already exists
            const resourceExists = await checkResourceExists(
              resourceType,
              resource.metadata.name,
              workspaceForMeta,
              isWorkspaced,
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
              const transformedResource = transformResourceForImport(
                resource,
                currentWorkspace,
              );

              const createMeta: Record<string, unknown> = {
                idColumnName: "metadata->name",
              };

              // Only add workspace context if the resource is workspace-scoped
              if (isWorkspaced) {
                createMeta.workspace = workspaceForMeta;
                createMeta.workspaced = true;
              }

              await createResource({
                resource: resourceType,
                values: transformedResource,
                meta: createMeta,
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
    },
    [
      checkResourceExists,
      createResource,
      currentWorkspace,
      t,
      resourcesConfigs,
    ],
  );

  const importFromFile = useCallback(
    async (file: File): Promise<void> => {
      try {
        const content = await file.text();
        await importFromYaml(content);
      } catch (error) {
        console.error(t("components.yamlImport.errors.readingFile"), error);
        setProgress({
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
        });
        setIsImporting(false);
      }
    },
    [importFromYaml, t],
  );

  const importFromUrl = useCallback(
    async (url: string): Promise<void> => {
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
        await importFromYaml(content);
      } catch (error) {
        console.error(
          t("components.yamlImport.errors.fetchingYamlFromUrl"),
          error,
        );
        setProgress({
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
        });
        setIsImporting(false);
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
