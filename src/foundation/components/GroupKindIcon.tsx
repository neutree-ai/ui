import { Network, User, Users } from "lucide-react";

const ICONS = { User, Team: Users, OrgUnit: Network } as const;

/** The icon of a user, Team or department, labelled for screen readers. */
export function GroupKindIcon({
  kind,
  label,
  testId,
}: {
  kind: keyof typeof ICONS;
  label: string;
  testId?: string;
}) {
  const Icon = ICONS[kind];
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex shrink-0 text-muted-foreground"
      data-testid={testId}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}
