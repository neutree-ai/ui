import type { ImageRegistry } from "@/domains/image-registry/types";
import {
  omitEmptyUntouched,
  type TouchedFields,
} from "@/foundation/lib/touched-fields";

export function transformImageRegistryValues(
  values: ImageRegistry,
  isEdit = false,
  touchedFields?: TouchedFields,
): ImageRegistry {
  const transformed = { ...values };
  if (isEdit) {
    omitEmptyUntouched(
      transformed.spec?.authconfig,
      ["spec", "authconfig"],
      ["username", "password"],
      touchedFields,
    );
  }
  return transformed;
}
