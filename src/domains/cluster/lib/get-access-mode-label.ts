const ACCESS_MODE_KEYS = ["LoadBalancer", "NodePort", "Ingress"] as const;
type AccessMode = (typeof ACCESS_MODE_KEYS)[number];

/** The translated access mode, or nothing for a mode the UI does not know. */
export function getAccessModeLabel(
  mode: string | undefined,
  t: (key: string) => string,
): string | undefined {
  return mode && ACCESS_MODE_KEYS.includes(mode as AccessMode)
    ? t(`status.accessModes.${mode}`)
    : undefined;
}
