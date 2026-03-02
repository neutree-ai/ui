export const inferSchemaFromValue = (
  value: unknown,
): Record<string, unknown> => {
  if (value === null) {
    return { type: "null" };
  }

  if (Array.isArray(value)) {
    const itemType =
      value.length > 0 ? inferSchemaFromValue(value[0]) : { type: "string" };
    return {
      type: "array",
      items: itemType,
    };
  }

  const actualType = typeof value;

  switch (actualType) {
    case "object": {
      const properties: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>)) {
        properties[key] = inferSchemaFromValue(
          (value as Record<string, unknown>)[key],
        );
      }
      return {
        type: "object",
        properties,
      };
    }
    case "string":
      return { type: "string" };
    case "number":
      return {
        type: Number.isInteger(value as number) ? "integer" : "number",
      };
    case "boolean":
      return { type: "boolean" };
    default:
      return { type: "string" };
  }
};
