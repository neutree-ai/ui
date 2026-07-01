import type { ModelRegistry } from "@/domains/model-registry/types";
import {
  type TouchedFields,
  isTouchedField,
} from "@/foundation/lib/touched-fields";

/**
 * Transform model registry form values before submission.
 * In edit mode, strip unchanged empty sensitive fields to avoid overwriting backend values.
 */
export function transformModelRegistryValues(
  values: ModelRegistry,
  isEdit = false,
  touchedFields?: TouchedFields,
): ModelRegistry {
  const transformed = { ...values };
  if (
    isEdit &&
    transformed.spec &&
    !transformed.spec.credentials &&
    !isTouchedField(touchedFields, ["spec", "credentials"])
  ) {
    delete transformed.spec.credentials;
  }
  return transformed;
}
