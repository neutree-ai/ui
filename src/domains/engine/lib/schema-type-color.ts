export const getTypeColorClass = (type: string): string => {
  switch (type) {
    case "object":
      return "text-blue-500 dark:text-blue-400";
    case "array":
      return "text-purple-500 dark:text-purple-400";
    case "string":
      return "text-green-500 dark:text-green-400";
    case "integer":
    case "number":
      return "text-amber-500 dark:text-amber-400";
    case "boolean":
      return "";
    default:
      return "text-muted-foreground";
  }
};
