import { getResourcePlural } from "@/foundation/lib/plural";
import type { Metadata } from "@/foundation/types/basic-types";
import * as yaml from "js-yaml";

// --- Types ---

export interface ResourceEntity {
  id: string | number;
  metadata: Metadata;
  kind: string;
  api_version: string;
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

export interface ExportOptions {
  removeStatus: boolean;
  removeIds: boolean;
  removeTimestamps: boolean;
  includeCredentials: boolean;
}

export interface YamlResource {
  apiVersion: string;
  kind: string;
  metadata: Metadata;
  spec: Record<string, unknown>;
}

// --- Export functions ---

/**
 * Transform a resource entity into a plain object suitable for YAML export.
 * Applies options to strip status, IDs, and timestamps as requested.
 */
export function transformEntityForExport(
  entity: ResourceEntity,
  options: ExportOptions,
): Record<string, unknown> {
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
    const metadata = yamlEntity.metadata as Record<string, unknown>;
    const { name, workspace, display_name, labels, annotations } = metadata as {
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
}

/**
 * Serialize an array of entity objects into a multi-document YAML string.
 * Documents are separated by `---`. Null/undefined values are omitted.
 */
export function serializeToYaml(entities: Record<string, unknown>[]): string {
  let yamlContent = "";
  for (let index = 0; index < entities.length; index++) {
    const entity = entities[index];
    if (index > 0) yamlContent += "\n---\n";
    yamlContent += yaml.dump(entity, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
      replacer: (_key: string, value: unknown) => {
        if (value === null || value === undefined) {
          return undefined;
        }
        return value;
      },
    });
  }
  return yamlContent;
}

// --- Import functions ---

/**
 * Convert a PascalCase kind string to a snake_case plural resource type.
 * e.g. "Cluster" -> "clusters", "ModelRegistry" -> "model_registries"
 */
export function kindToResourceType(kind: string): string {
  const snakeCase = kind
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .substring(1);

  const parts = snakeCase.split("_");
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    parts[parts.length - 1] = getResourcePlural(lastPart);
  }

  return parts.join("_");
}

/**
 * Parse a YAML string (possibly multi-document) into an array of YamlResource objects.
 * Non-resource documents (missing apiVersion/kind) are silently skipped.
 */
export function parseYamlDocuments(content: string): YamlResource[] {
  const resources: YamlResource[] = [];

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

  return resources;
}

/**
 * Transform a YAML resource for API consumption.
 * Converts apiVersion to api_version, applies workspace fallback, defaults labels.
 */
export function transformResourceForImport(
  resource: YamlResource,
  currentWorkspace: string,
): Record<string, unknown> {
  const workspaceToUse = resource.metadata.workspace || currentWorkspace;

  return {
    api_version: resource.apiVersion,
    kind: resource.kind,
    metadata: {
      ...resource.metadata,
      workspace: workspaceToUse,
      labels: resource.metadata.labels || {},
    },
    spec: resource.spec,
  };
}

/**
 * Type guard: check that a parsed YAML document has the minimum fields
 * required to be a valid importable resource (apiVersion, kind, metadata.name).
 */
export function isValidYamlResource(doc: unknown): doc is YamlResource {
  if (!doc || typeof doc !== "object") return false;
  const obj = doc as Record<string, unknown>;
  if (!obj.apiVersion || !obj.kind) return false;
  const metadata = obj.metadata as Record<string, unknown> | undefined;
  if (!metadata?.name) return false;
  return true;
}
