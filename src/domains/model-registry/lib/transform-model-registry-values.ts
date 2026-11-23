import type { ModelRegistry } from "@/domains/model-registry/types";
import {
  omitEmptyUntouched,
  type TouchedFields,
} from "@/foundation/role/touched-fields";

export function transformModelRegistryValues(
  values: ModelRegistry,
  isEdit = false,
  touchedFields?: TouchedFields,
): ModelRegistry {
  const transformed = { ...values };
  if (isEdit) {
    omitEmptyUntouched(
      transformed.spec,
      ["spec"],
      ["credentials"],
      touchedFields,
    );
  }
  return transformed;
}
