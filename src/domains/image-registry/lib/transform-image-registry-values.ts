import type { ImageRegistry } from "@/domains/image-registry/types";

/**
 * Transform image registry form values before submission.
 * In edit mode, strip empty sensitive fields to avoid overwriting backend values.
 */
export function transformImageRegistryValues(
  values: ImageRegistry,
  isEdit = false,
): ImageRegistry {
  const transformed = { ...values };

  if (isEdit && transformed.spec?.authconfig) {
    const authconfig = transformed.spec.authconfig;
    if (!authconfig.username) {
      delete authconfig.username;
    }
    if (!authconfig.password) {
      delete authconfig.password;
    }
  }

  return transformed;
}
