import type { ReactNode } from "react";
import type { TokenPoolSource } from "@/domains/group-policy/lib/subject-policy";
import { GroupKindIcon } from "@/foundation/components/GroupKindIcon";
import { displayName } from "@/foundation/lib/display-name";
import { useTranslation } from "@/foundation/lib/i18n";

export type GroupRenderer = (
  name: string,
  displayName?: string | null,
) => ReactNode;
export const plainLabel: GroupRenderer = (name, display_name) =>
  displayName({ name, display_name });

/**
 * Where a policy or pool comes from: a Team or department, or the subject's
 * own limit and the scope it was set in.
 */
export function PolicySourceLabel({
  source,
  renderTeam = plainLabel,
  renderOrgUnit = plainLabel,
}: {
  source: TokenPoolSource;
  renderTeam?: GroupRenderer;
  renderOrgUnit?: GroupRenderer;
}) {
  const { t } = useTranslation();
  const render = (kind: "Team" | "OrgUnit", name: string, label: string) =>
    kind === "Team" ? renderTeam(name, label) : renderOrgUnit(name, label);

  if (source.owner === "group") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <GroupKindIcon
          kind={source.kind}
          label={t(`group_policies.kinds.${source.kind}`)}
        />
        {render(source.kind, source.name, source.label)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <GroupKindIcon kind="User" label={t("group_policies.subject.own")} />
      {source.scopeKind && source.scopeName ? (
        <span className="inline-flex items-center gap-1">
          {t("group_policies.subject.setIn")}
          {/* Its own element: a plain-string label would merge with the text
              before it into one flex item, and the gap would not apply. */}
          <span>
            {render(
              source.scopeKind,
              source.scopeName,
              source.scopeLabel ?? source.scopeName,
            )}
          </span>
        </span>
      ) : (
        t("group_policies.subject.setGlobally")
      )}
    </span>
  );
}
