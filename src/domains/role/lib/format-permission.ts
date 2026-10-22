import type { useTranslation } from "react-i18next";
import { getResourcePlural } from "@/foundation/lib/plural";

type Translate = ReturnType<typeof useTranslation>["t"];

// Resources whose page title reads wrong as a permission label: "Model access:
// Read" sounds like calling models, not reading the policy.
const RESOURCE_LABEL_KEYS: Record<string, string> = {
  group_policy: "group_policies.permissionTitle",
};

/** "model" → "Models": the resource name in permission labels. */
export const formatResource = (t: Translate, resource: string) =>
  t(RESOURCE_LABEL_KEYS[resource] ?? `${getResourcePlural(resource)}.title`);

/** "model:push" → "Models:Push" (system permissions have their own labels) */
export const formatPermission = (t: Translate, permission: string) => {
  const [resource, action] = permission.split(":");
  if (resource === "system") {
    return t(`permissions.${resource}_${action}`);
  }
  return `${formatResource(t, resource)}:${t(`permissions.${action}`)}`;
};
