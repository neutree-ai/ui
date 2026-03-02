import { inferSchemaFromValue } from "./infer-schema";

interface MergedProperties {
  schemaProperties: Record<string, unknown>;
  extraProperties: Record<string, Record<string, unknown>>;
}

export const mergeSchemaProperties = (
  schema: Record<string, unknown>,
  value: unknown,
): MergedProperties => {
  const schemaProperties =
    (schema?.properties as Record<string, unknown>) || {};
  const extraProperties: Record<string, Record<string, unknown>> = {};

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const valueObj = value as Record<string, unknown>;
    for (const key of Object.keys(valueObj)) {
      if (!schemaProperties[key]) {
        extraProperties[key] = inferSchemaFromValue(valueObj[key]);
      }
    }
  }

  return { schemaProperties, extraProperties };
};
