import type { ModelRegistry } from "@/domains/model-registry/types";

/**
 * Transform model registry form values before submission.
 * In edit mode, strip empty sensitive fields to avoid overwriting backend values.
 */
export function transformModelRegistryValues(
  values: ModelRegistry,
  isEdit = false,
): ModelRegistry {
  const transformed = { ...values };

  if (isEdit && transformed.spec) {
    if (!transformed.spec.credentials) {
      delete transformed.spec.credentials;
    }
  }

  return transformed;
}
