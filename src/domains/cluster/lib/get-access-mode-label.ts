const ACCESS_MODE_KEYS = ["LoadBalancer", "NodePort", "Ingress"] as const;
type AccessMode = (typeof ACCESS_MODE_KEYS)[number];

export function getAccessModeLabel(
  mode: string | undefined,
  t: (key: string) => string,
): string {
  if (mode && ACCESS_MODE_KEYS.includes(mode as AccessMode)) {
    return t(`status.accessModes.${mode}`);
  }
  return "-";
}
