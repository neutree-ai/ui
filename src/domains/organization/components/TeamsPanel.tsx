import { Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AddTeamMembersDialog } from "@/domains/organization/components/AddTeamMembersDialog";
import { InactiveBadge } from "@/domains/organization/components/InactiveBadge";
import { MemberTable } from "@/domains/organization/components/MemberTable";
import { OrganizationToolbar } from "@/domains/organization/components/OrganizationToolbar";
import { TeamFormDialog } from "@/domains/organization/components/TeamFormDialog";
import { TeamSourceLabel } from "@/domains/organization/components/TeamSourceLabel";
import {
  TeamWriteNoRowError,
  useTeamMembers,
  useTeamMemberWrites,
  useTeams,
  useTeamWrites,
} from "@/domains/organization/hooks/use-organization";
import {
  displayName,
  filterTeams,
  isInactive,
} from "@/domains/organization/lib/org-tree";
import { organizationErrorMessage } from "@/domains/organization/lib/organization-errors";
import { isManualTeam, teamSource } from "@/domains/organization/lib/team";
import { ConfirmDialog } from "@/foundation/components/ConfirmDialog";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useHasGlobalPermission } from "@/foundation/hooks/use-has-permission";
import { getApiErrorCode } from "@/foundation/lib/api-error-code";
import {
  getErrorMessage,
  isDuplicateNameError,
} from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

type OpenDialog =
  | { kind: "create" }
  | { kind: "edit" }
  | { kind: "add-members" }
  | { kind: "delete" }
  | { kind: "remove-member"; userId: string };

/**
 * Teams synced from identity sources (read-only) and Teams created in
 * Neutree, which global team:create / update / delete / assign-member manage.
 * A manual Team is always Active, so there is no phase switch.
 * `renderRoleAssignments` lists the selected Team's role assignments.
 */
export function TeamsPanel({
  renderRoleAssignments,
}: {
  renderRoleAssignments?: (teamName: string) => ReactNode;
} = {}) {
  const { t } = useTranslation();
  const errorText = (error: unknown, creating = false) => {
    if (!error) return undefined;
    if (error instanceof TeamWriteNoRowError) {
      return t(
        error.target === "team"
          ? "organization.teams.errors.teamGone"
          : "organization.teams.errors.memberGone",
      );
    }
    if (creating && isDuplicateNameError(error)) {
      return t("organization.teams.errors.nameTaken");
    }
    if (getApiErrorCode(error) === "42501") {
      return t("organization.teams.errors.denied");
    }
    return (
      organizationErrorMessage(t, error) ??
      getErrorMessage(error, t("common.errors.unknown"))
    );
  };

  const canCreate = useHasGlobalPermission("team:create").allowed === true;
  const canUpdate = useHasGlobalPermission("team:update").allowed === true;
  const canDelete = useHasGlobalPermission("team:delete").allowed === true;
  const canAssign =
    useHasGlobalPermission("team:assign-member").allowed === true;

  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<number>();
  const [dialog, setDialog] = useState<OpenDialog>();
  const [dialogError, setDialogError] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  const { data, isLoading, error } = useTeams();
  const all = data?.data ?? [];
  const teams = useMemo(
    () => filterTeams(data?.data ?? [], { query, showInactive }),
    [data, query, showInactive],
  );
  const selected = all.find((team) => team.id === selectedId);
  const members = useTeamMembers(selected?.id);
  const teamWrites = useTeamWrites();
  const memberWrites = useTeamMemberWrites(selected?.id);
  const manual = !!selected && isManualTeam(selected);
  const memberIds = useMemo(
    () => new Set(members.members.map((m) => m.user_id)),
    [members.members],
  );

  const open = (next: OpenDialog) => {
    setDialogError(undefined);
    setActionError(undefined);
    setDialog(next);
  };
  const close = () => setDialog(undefined);

  const select = (id: number | undefined) => {
    setSelectedId(id);
    setActionError(undefined);
  };

  /** Form dialogs keep the error; confirm dialogs report it below the members. */
  const attempt = async (
    action: () => Promise<unknown>,
    { creating = false, inline = false } = {},
  ) => {
    try {
      await action();
      close();
    } catch (cause) {
      const message = errorText(cause, creating);
      if (inline) {
        setActionError(message);
        close();
      } else {
        setDialogError(message);
      }
    }
  };

  return (
    <div className="space-y-3">
      <OrganizationToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder={t("organization.filters.searchTeams")}
        showInactive={showInactive}
        onShowInactiveChange={setShowInactive}
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ShowPage.Section
          title={t("organization.teams.title")}
          actions={
            canCreate && (
              <Button
                size="sm"
                onClick={() => open({ kind: "create" })}
                data-testid="team-create"
              >
                <Plus className="mr-1 h-4 w-4" />
                {t("organization.teams.create")}
              </Button>
            )
          }
          contentClassName="max-h-[calc(100vh-300px)] min-h-40 overflow-auto px-3 pb-4 pt-3"
        >
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader className="w-10 text-muted-foreground" />
            </div>
          ) : error ? (
            <EmptyState variant="inline" className="text-destructive">
              {errorText(error)}
            </EmptyState>
          ) : !teams.length ? (
            <EmptyState variant="inline" data-testid="teams-empty">
              {all.length
                ? t("organization.teams.noMatch")
                : t("organization.teams.empty")}
            </EmptyState>
          ) : (
            <ul className="space-y-0.5" data-testid="team-list">
              {teams.map((team) => (
                <li key={team.id}>
                  <button
                    type="button"
                    aria-pressed={team.id === selectedId}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      team.id === selectedId
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted",
                      isInactive(team) && "text-muted-foreground",
                    )}
                    onClick={() => select(team.id)}
                    data-testid={`team-${team.id}`}
                  >
                    <span className="truncate">
                      {displayName(team.metadata)}
                    </span>
                    {isInactive(team) && <InactiveBadge />}
                    <span className="ml-auto" />
                    <TeamSourceLabel team={team} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ShowPage.Section>

        <div className="min-w-0 space-y-3">
          <ShowPage.Section
            title={
              selected ? (
                <span className="inline-flex items-center gap-2">
                  {displayName(selected.metadata)}
                  {isInactive(selected) && <InactiveBadge />}
                </span>
              ) : (
                t("organization.members.title")
              )
            }
            description={
              selected &&
              (manual
                ? t("organization.teams.manualSource", {
                    name: selected.metadata.name,
                  })
                : t("organization.teams.syncedSource", {
                    source: teamSource(selected),
                  }))
            }
            actions={
              manual && (
                <div className="flex items-center gap-2">
                  {canAssign && (
                    <Button
                      size="sm"
                      onClick={() => open({ kind: "add-members" })}
                      data-testid="team-add-members"
                    >
                      <UserPlus className="mr-1 h-4 w-4" />
                      {t("organization.teams.addMembers")}
                    </Button>
                  )}
                  {canUpdate && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => open({ kind: "edit" })}
                      data-testid="team-edit"
                    >
                      <Pencil className="mr-1 h-4 w-4" />
                      {t("buttons.edit")}
                    </Button>
                  )}
                  {canDelete && (
                    <ConfirmDialog
                      open={dialog?.kind === "delete"}
                      onOpenChange={(next) =>
                        next ? open({ kind: "delete" }) : close()
                      }
                      title={t("organization.teams.deleteTitle", {
                        team: displayName(selected.metadata),
                      })}
                      description={t("organization.teams.deleteHint", {
                        count: members.members.length,
                      })}
                      okText={t("buttons.delete")}
                      cancelText={t("buttons.cancel")}
                      okButtonVariant="destructive"
                      loading={teamWrites.isPending}
                      onConfirm={() =>
                        attempt(
                          async () => {
                            await teamWrites.remove(selected);
                            select(undefined);
                          },
                          { inline: true },
                        )
                      }
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        data-testid="team-delete"
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        {t("buttons.delete")}
                      </Button>
                    </ConfirmDialog>
                  )}
                </div>
              )
            }
          >
            {selected ? (
              <MemberTable
                rows={members.members.map((m) => ({
                  key: m.user_id,
                  profile: m.user_profiles,
                  since: m.created_at,
                }))}
                isLoading={members.isLoading}
                error={errorText(members.error)}
                sinceLabel={t("organization.fields.joinedAt")}
                renderActions={
                  manual && canAssign
                    ? (row) => (
                        <ConfirmDialog
                          open={
                            dialog?.kind === "remove-member" &&
                            dialog.userId === row.key
                          }
                          onOpenChange={(next) =>
                            next
                              ? open({ kind: "remove-member", userId: row.key })
                              : close()
                          }
                          title={t("organization.teams.removeMemberTitle")}
                          description={t(
                            "organization.teams.removeMemberHint",
                            {
                              user: row.profile
                                ? displayName(row.profile.metadata)
                                : row.key,
                              team: displayName(selected.metadata),
                            },
                          )}
                          okText={t("organization.teams.removeMember")}
                          cancelText={t("buttons.cancel")}
                          okButtonVariant="destructive"
                          loading={memberWrites.isPending}
                          onConfirm={() =>
                            attempt(() => memberWrites.remove(row.key), {
                              inline: true,
                            })
                          }
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            aria-label={t("organization.teams.removeMember")}
                            title={t("organization.teams.removeMember")}
                            data-testid={`team-remove-member-${row.key}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </ConfirmDialog>
                      )
                    : undefined
                }
              />
            ) : (
              <EmptyState variant="inline">
                {t("organization.members.selectTeam")}
              </EmptyState>
            )}
            {actionError && (
              <Alert
                variant="destructive"
                className="mt-3"
                data-testid="team-action-error"
              >
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
          </ShowPage.Section>
          {selected && renderRoleAssignments?.(selected.metadata.name)}
        </div>
      </div>

      {dialog?.kind === "create" && (
        <TeamFormDialog
          onOpenChange={(next) => !next && close()}
          saving={teamWrites.isPending}
          error={dialogError}
          onSave={({ name, displayName: label }) =>
            attempt(
              async () => {
                const created = await teamWrites.create(name, label);
                if (created) select(created.id);
              },
              { creating: true },
            )
          }
        />
      )}
      {dialog?.kind === "edit" && selected && (
        <TeamFormDialog
          onOpenChange={(next) => !next && close()}
          team={selected}
          saving={teamWrites.isPending}
          error={dialogError}
          onSave={({ displayName: label }) =>
            attempt(() => teamWrites.rename(selected, label))
          }
        />
      )}
      {dialog?.kind === "add-members" && selected && (
        <AddTeamMembersDialog
          onOpenChange={(next) => !next && close()}
          teamName={displayName(selected.metadata)}
          memberIds={memberIds}
          saving={memberWrites.isPending}
          error={dialogError}
          onSave={(userIds) => attempt(() => memberWrites.add(userIds))}
        />
      )}
    </div>
  );
}
