import type { ImageRegistry } from "@/domains/image-registry/types";
import { type DirtyFields, isDirtyField } from "@/foundation/lib/dirty-fields";

/**
 * Transform image registry form values before submission.
 * In edit mode, strip unchanged empty sensitive fields to avoid overwriting backend values.
 */
export function transformImageRegistryValues(
  values: ImageRegistry,
  isEdit = false,
  dirtyFields?: DirtyFields,
): ImageRegistry {
  const transformed = { ...values };
  if (isEdit && transformed.spec?.authconfig) {
    const authconfig = transformed.spec.authconfig;
    if (
      !authconfig.username &&
      !isDirtyField(dirtyFields, ["spec", "authconfig", "username"])
    ) {
      delete authconfig.username;
    }
    if (
      !authconfig.password &&
      !isDirtyField(dirtyFields, ["spec", "authconfig", "password"])
    ) {
      delete authconfig.password;
    }
  }
  return transformed;
}
