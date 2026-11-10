import { useGetIdentity } from "@refinedev/core";
import { useEffect, useRef, useState } from "react";
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
import { TokenPoolSummary } from "@/domains/group-policy/components/GroupModelAccess";
import { ModelEntryList } from "@/domains/group-policy/components/ModelEntryList";
import {
  type GroupRenderer,
  PolicySourceLabel,
  plainLabel,
} from "@/domains/group-policy/components/PolicySourceLabel";
import { useUserGroupPolicy } from "@/domains/group-policy/hooks/use-group-policies";
import {
  subjectPolicySource,
  tokenPoolSource,
} from "@/domains/group-policy/lib/subject-policy";
import type { GroupPolicyModel } from "@/domains/group-policy/types";
import { EMPTY_VALUE } from "@/foundation/components/EmptyValue";
import { GroupKindIcon } from "@/foundation/components/GroupKindIcon";
import { InactiveBadge } from "@/foundation/components/InactiveBadge";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { useWorkspaceOptions } from "@/foundation/hooks/use-workspace";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";

/** Anchor of the section; the API key page links to it. */
const USER_MODEL_ACCESS_ANCHOR = "user-model-access";
/** Query parameter that preselects the workspace. */
export const USER_MODEL_ACCESS_WORKSPACE_PARAM = "model_access_workspace";

/** This section on a user's page, with `workspace` preselected. */
export const userModelAccessHref = (profileName: string, workspace: string) =>
  `/user-profiles/show/${encodeURIComponent(profileName)}?${USER_MODEL_ACCESS_WORKSPACE_PARAM}=${encodeURIComponent(workspace)}#${USER_MODEL_ACCESS_ANCHOR}`;

const inWorkspace = (
  entries: GroupPolicyModel[] | null,
  workspace: string | null,
) =>
  (entries ?? []).filter(
    (entry) =>
      workspace === null || !entry.workspace || entry.workspace === workspace,
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
 * group_policy:read on any scope (a department admin reads their subtree's
 * users); hidden when the server refuses. A reader who sees no workspace gets
 * each group's rules without the merged result.
 */
export function UserGroupModelAccess({
  userId,
  initialWorkspace,
  renderTeam = plainLabel,
  renderOrgUnit = plainLabel,
}: {
  userId: string;
  initialWorkspace?: string;
  /** `displayName` comes with the policy, for readers of no groups. */
  renderTeam?: GroupRenderer;
  renderOrgUnit?: GroupRenderer;
}) {
  const { t } = useTranslation();
  const { data: identity } = useGetIdentity<{ id?: string }>();
  const canRead = useHasPermission("group_policy:read").allowed === true;
  const visible = canRead || (!!identity?.id && identity.id === userId);
  const { workspaces, isLoading: workspacesLoading } = useWorkspaceOptions();
  const names = workspaces.map((ws) => ws.metadata.name as string);
  const [picked, setPicked] = useState(initialWorkspace ?? "");
  const noWorkspace = !workspacesLoading && names.length === 0;
  const workspace: string | null = noWorkspace
    ? null
    : picked || names[0] || "";
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
  const own = policy?.subject_policies ?? [];
  const pools = policy?.token_pools ?? [];

  return (
    <div id={USER_MODEL_ACCESS_ANCHOR} ref={ref}>
      <ShowPage.Section
        title={t("group_policies.title")}
        description={t("group_policies.userHint")}
        actions={
          workspace === null ? undefined : (
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
          )
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
            {workspace === null ? (
              <p
                className="text-sm text-muted-foreground"
                data-testid="user-model-access-no-workspace"
              >
                {t("group_policies.effective.noWorkspace")}
              </p>
            ) : (
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
            )}
            {groups.length === 0 && own.length === 0 ? (
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
                    return (
                      <TableRow
                        key={`${group.kind}/${group.name}`}
                        data-testid={`user-model-access-group-${group.kind}-${group.name}`}
                      >
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            <GroupKindIcon
                              kind={group.kind}
                              label={t(`group_policies.kinds.${group.kind}`)}
                            />
                            {group.kind === "Team"
                              ? renderTeam(group.name, group.display_name)
                              : renderOrgUnit(group.name, group.display_name)}
                            {!group.active && (
                              <InactiveBadge
                                title={t(
                                  "group_policies.effective.inactiveHint",
                                )}
                              />
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ModelEntryList
                            entries={inWorkspace(
                              group.allowed_models,
                              workspace,
                            )}
                            emptyText={EMPTY_VALUE}
                          />
                        </TableCell>
                        <TableCell>
                          <ModelEntryList
                            entries={inWorkspace(
                              group.denied_models,
                              workspace,
                            )}
                            emptyText={EMPTY_VALUE}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {own.map((policy) => (
                    <TableRow
                      key={policy.name}
                      data-testid={`user-model-access-own-${policy.name}`}
                    >
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <PolicySourceLabel
                            source={subjectPolicySource(policy)}
                            renderTeam={renderTeam}
                            renderOrgUnit={renderOrgUnit}
                          />
                          {!policy.in_scope && (
                            <InactiveBadge
                              title={t("group_policies.subject.notInScope")}
                            />
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ModelEntryList
                          entries={inWorkspace(
                            policy.allowed_models,
                            workspace,
                          )}
                          emptyText={EMPTY_VALUE}
                        />
                      </TableCell>
                      <TableCell>
                        <ModelEntryList
                          entries={inWorkspace(policy.denied_models, workspace)}
                          emptyText={EMPTY_VALUE}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {pools.length > 0 && (
              <div className="space-y-2" data-testid="user-token-pools">
                <div className="text-xs font-medium text-muted-foreground">
                  {t("group_policies.pool.userTitle")}
                </div>
                <ul className="space-y-2 text-sm">
                  {pools.map((pool) => (
                    <li
                      key={`${pool.kind}/${pool.name}/${pool.scope_kind ?? ""}/${pool.scope_name ?? ""}`}
                      className="flex flex-wrap items-start gap-x-3 gap-y-1"
                      data-testid={`user-token-pool-${pool.kind}-${pool.scope_name ?? pool.name}`}
                    >
                      <span className="min-w-32 font-medium">
                        <PolicySourceLabel
                          source={tokenPoolSource(pool)}
                          renderTeam={renderTeam}
                          renderOrgUnit={renderOrgUnit}
                        />
                      </span>
                      <TokenPoolSummary
                        quota={{ limit: pool.token_limit, period: pool.period }}
                        pool={pool}
                      />
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  {t("group_policies.pool.userHint")}
                </p>
              </div>
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
