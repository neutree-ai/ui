export const getActualType = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

export const checkTypeMatch = (
  value: unknown,
  expectedType: string,
): boolean => {
  const actualType = getActualType(value);
  return (
    actualType === expectedType ||
    (expectedType === "integer" &&
      actualType === "number" &&
      Number.isInteger(value)) ||
    (expectedType === "number" && actualType === "number")
  );
};
