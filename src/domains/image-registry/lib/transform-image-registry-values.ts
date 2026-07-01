import type { ImageRegistry } from "@/domains/image-registry/types";
import {
  type TouchedFields,
  isTouchedField,
} from "@/foundation/lib/touched-fields";

/**
 * Transform image registry form values before submission.
 * In edit mode, strip unchanged empty sensitive fields to avoid overwriting backend values.
 */
export function transformImageRegistryValues(
  values: ImageRegistry,
  isEdit = false,
  touchedFields?: TouchedFields,
): ImageRegistry {
  const transformed = { ...values };
  if (isEdit && transformed.spec?.authconfig) {
    const authconfig = transformed.spec.authconfig;
    if (
      !authconfig.username &&
      !isTouchedField(touchedFields, ["spec", "authconfig", "username"])
    ) {
      delete authconfig.username;
    }
    if (
      !authconfig.password &&
      !isTouchedField(touchedFields, ["spec", "authconfig", "password"])
    ) {
      delete authconfig.password;
    }
  }
  return transformed;
}
