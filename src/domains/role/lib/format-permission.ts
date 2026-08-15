import type { useTranslation } from "react-i18next";
import { getResourcePlural } from "@/foundation/lib/plural";

type Translate = ReturnType<typeof useTranslation>["t"];

/** "model:push" → "Models:Push" (system permissions have their own labels) */
export const formatPermission = (t: Translate, permission: string) => {
  const [resource, action] = permission.split(":");
  if (resource === "system") {
    return t(`permissions.${resource}_${action}`);
  }
  return `${t(`${getResourcePlural(resource)}.title`)}:${t(`permissions.${action}`)}`;
};
