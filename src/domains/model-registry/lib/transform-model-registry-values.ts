import type { ModelRegistry } from "@/domains/model-registry/types";
import { type DirtyFields, isDirtyField } from "@/foundation/lib/dirty-fields";

/**
 * Transform model registry form values before submission.
 * In edit mode, strip unchanged empty sensitive fields to avoid overwriting backend values.
 */
export function transformModelRegistryValues(
  values: ModelRegistry,
  isEdit = false,
  dirtyFields?: DirtyFields,
): ModelRegistry {
  const transformed = { ...values };
  if (
    isEdit &&
    transformed.spec &&
    !transformed.spec.credentials &&
    !isDirtyField(dirtyFields, ["spec", "credentials"])
  ) {
    delete transformed.spec.credentials;
  }
  return transformed;
}
