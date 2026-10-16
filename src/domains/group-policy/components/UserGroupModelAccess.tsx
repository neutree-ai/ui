import { useGetIdentity } from "@refinedev/core";
import { Network, Users } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ModelEntryList } from "@/domains/group-policy/components/ModelEntryList";
import { useUserGroupPolicy } from "@/domains/group-policy/hooks/use-group-policies";
import type { GroupPolicyModel } from "@/domains/group-policy/types";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";
import { useWorkspaceOptions } from "@/foundation/hooks/use-workspace";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";

/** Anchor of the section; the API key page links to it. */
export const USER_MODEL_ACCESS_ANCHOR = "user-model-access";
/** Query parameter that preselects the workspace. */
export const USER_MODEL_ACCESS_WORKSPACE_PARAM = "model_access_workspace";

const inWorkspace = (entries: GroupPolicyModel[] | null, workspace: string) =>
  (entries ?? []).filter(
    (entry) => !entry.workspace || entry.workspace === workspace,
  );

const Names = ({
  names,
  emptyText,
  testId,
}: {
  names: string[];
  emptyText: string;
  testId: string;
}) =>
  names.length === 0 ? (
    <span className="text-sm text-muted-foreground" data-testid={testId}>
      {emptyText}
    </span>
  ) : (
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {names.map((name) => (
        <Badge key={name} variant="outline" className="font-normal">
          {name}
        </Badge>
      ))}
    </div>
  );

/**
 * How the user's groups limit the models they can call in a workspace: the
 * merged result, then each group's share. Shown to the user and to holders of
 * a global group_policy:read; hidden when the server refuses.
 */
export function UserGroupModelAccess({
  userId,
  initialWorkspace,
  renderTeam = (name) => name,
  renderOrgUnit = (name) => name,
}: {
  userId: string;
  initialWorkspace?: string;
  renderTeam?: (name: string) => ReactNode;
  renderOrgUnit?: (name: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const { data: identity } = useGetIdentity<{ id?: string }>();
  const canReadAny =
    useHasGlobalPermission("group_policy:read").allowed === true;
  const visible = canReadAny || (!!identity?.id && identity.id === userId);
  const { workspaces } = useWorkspaceOptions();
  const names = workspaces.map((ws) => ws.metadata.name as string);
  const [picked, setPicked] = useState(initialWorkspace ?? "");
  const workspace = picked || names[0] || "";
  const { policy, isLoading, denied, error } = useUserGroupPolicy(
    userId,
    workspace,
    visible,
  );

  const ref = useRef<HTMLDivElement>(null);
  const shown = visible && !denied;
  useEffect(() => {
    if (shown && window.location.hash === `#${USER_MODEL_ACCESS_ANCHOR}`) {
      ref.current?.scrollIntoView({ block: "start" });
    }
  }, [shown]);

  if (!shown) return null;

  const groups = policy?.groups ?? [];

  return (
    <div id={USER_MODEL_ACCESS_ANCHOR} ref={ref}>
      <ShowPage.Section
        title={t("group_policies.title")}
        description={t("group_policies.userHint")}
        actions={
          <Select value={workspace} onValueChange={setPicked}>
            <SelectTrigger
              className="w-48"
              aria-label={t("common.fields.workspace")}
              data-testid="user-model-access-workspace"
            >
              <SelectValue placeholder={t("common.fields.workspace")} />
            </SelectTrigger>
            <SelectContent>
              {names.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        data-testid="user-model-access"
      >
        {isLoading ? (
          <Loader className="h-4 text-primary" />
        ) : error ? (
          <p className="text-sm text-destructive">
            {getErrorMessage(error, t("common.errors.unknown"))}
          </p>
        ) : policy ? (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="mb-1 text-xs font-medium text-muted-foreground">
                  {t("group_policies.effective.allowed")}
                </dt>
                <dd>
                  {policy.allowed_models === null ? (
                    <span
                      className="text-sm text-muted-foreground"
                      data-testid="user-model-access-allowed"
                    >
                      {t("group_policies.unrestricted")}
                    </span>
                  ) : (
                    <Names
                      names={policy.allowed_models}
                      emptyText={t("group_policies.effective.noneAllowed")}
                      testId="user-model-access-allowed"
                    />
                  )}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-xs font-medium text-muted-foreground">
                  {t("group_policies.effective.denied")}
                </dt>
                <dd>
                  <Names
                    names={policy.denied_models ?? []}
                    emptyText={t("group_policies.effective.noneDenied")}
                    testId="user-model-access-denied"
                  />
                </dd>
              </div>
            </dl>
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("group_policies.effective.noGroups")}
              </p>
            ) : (
              <Table data-testid="user-model-access-groups">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("group_policies.effective.group")}</TableHead>
                    <TableHead>{t("group_policies.fields.allowed")}</TableHead>
                    <TableHead>{t("group_policies.fields.denied")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => {
                    const Icon = group.kind === "Team" ? Users : Network;
                    return (
                      <TableRow
                        key={`${group.kind}/${group.name}`}
                        data-testid={`user-model-access-group-${group.kind}-${group.name}`}
                      >
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            <Icon
                              className="h-4 w-4 shrink-0 text-muted-foreground"
                              aria-label={
                                group.kind === "Team"
                                  ? t("group_policies.kinds.Team")
                                  : t("group_policies.kinds.OrgUnit")
                              }
                            />
                            {group.kind === "Team"
                              ? renderTeam(group.name)
                              : renderOrgUnit(group.name)}
                            {!group.active && (
                              <Badge
                                variant="secondary"
                                className="shrink-0 px-1.5 py-0 font-normal"
                                title={t(
                                  "group_policies.effective.inactiveHint",
                                )}
                              >
                                {t("group_policies.effective.inactive")}
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ModelEntryList
                            entries={inWorkspace(
                              group.allowed_models,
                              workspace,
                            )}
                            emptyText="-"
                          />
                        </TableCell>
                        <TableCell>
                          <ModelEntryList
                            entries={inWorkspace(
                              group.denied_models,
                              workspace,
                            )}
                            emptyText="-"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            <p className="text-xs text-muted-foreground">
              {t("group_policies.mergeRules")}
            </p>
          </div>
        ) : null}
      </ShowPage.Section>
    </div>
  );
}
