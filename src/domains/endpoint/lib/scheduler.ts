/** The display name of a known scheduler type, or null for an unset or
 * unrecognised one — callers choose what to show instead. */
export const schedulerLabel = (
  type: string | null | undefined,
  t: (key: string) => string,
): string | null => {
  switch (type) {
    case "consistent_hash":
      return t("models.scheduler.consistentHashing");
    case "roundrobin":
      return t("models.scheduler.roundRobin");
    default:
      return null;
  }
};
