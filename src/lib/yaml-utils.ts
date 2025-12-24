import * as clipboard from "clipboard-polyfill";
import * as yaml from "js-yaml";
import { toast } from "sonner";

export interface ExportOptions {
  removeStatus?: boolean;
  removeIds?: boolean;
  removeTimestamps?: boolean;
}

export interface YamlEntity {
  apiVersion?: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Transform a resource entity to YAML format based on export options
 */
export const transformEntityToYaml = (
  entity: any,
  options: ExportOptions = {},
): YamlEntity => {
  const yamlEntity: YamlEntity = {
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
};

/**
 * Generate YAML content from a single entity
 */
export const generateYamlContentFromEntity = (
  entity: any,
  options: ExportOptions = {},
): string => {
  const yamlEntity = transformEntityToYaml(entity, options);

  return yaml.dump(yamlEntity, {
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
};

/**
 * Generate YAML content from multiple entities (with document separators)
 */
export const generateYamlContentFromEntities = (
  entities: YamlEntity[],
): string => {
  let yamlContent = "";
  for (let index = 0; index < entities.length; index++) {
    const entity = entities[index];
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
};

/**
 * Copy YAML content to clipboard
 */
export const copyYamlToClipboard = async (
  yamlContent: string,
  translate: (key: string, options?: any) => string,
): Promise<void> => {
  try {
    await clipboard.writeText(yamlContent);
    toast.success(translate("components.yamlExport.copySuccess"), {
      description: translate("components.yamlExport.copySuccessDescription"),
    });
  } catch (error) {
    toast.error(translate("components.yamlExport.errors.copyFailed"));
    throw error;
  }
};

/**
 * Download YAML content as a file
 */
export const downloadYamlFile = (
  yamlContent: string,
  filename: string,
  translate: (key: string, options?: any) => string,
): void => {
  const blob = new Blob([yamlContent], { type: "application/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast.success(translate("components.yamlExport.downloadSuccess"), {
    description: translate("components.yamlExport.downloadSuccessDescription"),
  });
};

/**
 * Get default export options for single entity export
 */
export const getDefaultExportOptions = (): ExportOptions => ({
  removeStatus: true,
  removeIds: true,
  removeTimestamps: true,
});

/**
 * Generate filename for single entity YAML export
 */
export const generateEntityFilename = (resource: string): string => {
  return `${resource}-${new Date().toISOString().split("T")[0]}.yaml`;
};

/**
 * Generate filename for multiple entities YAML export
 */
export const generateEntitiesFilename = (): string => {
  return `resources-${new Date().toISOString().split("T")[0]}.yaml`;
};
