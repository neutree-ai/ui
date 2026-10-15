import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingIcon } from "@/components/ui/loading";
import { useAllUsers } from "@/domains/organization/hooks/use-organization";
import { EmptyState } from "@/foundation/components/EmptyState";
import { Loader } from "@/foundation/components/Loader";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  profileDisplayName,
  profileIdentitySourceName,
} from "@/foundation/lib/user-identity";

type AddTeamMembersDialogProps = {
  onOpenChange: (open: boolean) => void;
  teamName: string;
  memberIds: ReadonlySet<string>;
  saving?: boolean;
  error?: string;
  onSave: (userIds: string[]) => void;
};

/** Picks users, local or external, to add to a manual Team. */
export function AddTeamMembersDialog({
  onOpenChange,
  teamName,
  memberIds,
  saving,
  error,
  onSave,
}: AddTeamMembersDialogProps) {
  const { t } = useTranslation();
  const users = useAllUsers(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (users.data?.data ?? [])
      .filter(
        (user) =>
          !needle ||
          [user.metadata.name, user.metadata.display_name, user.spec?.email]
            .filter(Boolean)
            .some((text) => String(text).toLowerCase().includes(needle)),
      )
      .sort((a, b) =>
        profileDisplayName(a.metadata).localeCompare(
          profileDisplayName(b.metadata),
        ),
      );
  }, [users.data, query]);

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("organization.teams.addMembersTitle")}</DialogTitle>
          <DialogDescription>
            {t("organization.teams.addMembersHint", { team: teamName })}
          </DialogDescription>
        </DialogHeader>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("organization.teams.searchUsers")}
          data-testid="add-members-search"
        />
        <div
          className="max-h-80 min-h-32 overflow-auto rounded-md border p-1"
          data-testid="add-members-list"
        >
          {users.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader className="w-10 text-muted-foreground" />
            </div>
          ) : users.error ? (
            <EmptyState variant="inline" className="text-destructive">
              {getErrorMessage(users.error, t("common.errors.unknown"))}
            </EmptyState>
          ) : !rows.length ? (
            <EmptyState variant="inline">
              {t("organization.teams.noUsers")}
            </EmptyState>
          ) : (
            <ul>
              {rows.map((user) => {
                const isMember = memberIds.has(user.id);
                const source = profileIdentitySourceName(user.metadata);
                const id = `add-member-${user.id}`;
                return (
                  <li key={user.id}>
                    <label
                      htmlFor={id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted has-[:disabled]:cursor-default has-[:disabled]:opacity-60"
                    >
                      <Checkbox
                        id={id}
                        checked={isMember || selected.has(user.id)}
                        disabled={isMember}
                        onCheckedChange={(on) => toggle(user.id, on === true)}
                        data-testid={id}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">
                          {profileDisplayName(user.metadata)}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[user.metadata.name, user.spec?.email]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {isMember
                          ? t("organization.teams.alreadyMember")
                          : source || t("organization.values.local")}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {error && (
          <Alert variant="destructive" data-testid="add-members-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("buttons.cancel")}
          </Button>
          <Button
            onClick={() => onSave([...selected])}
            disabled={saving || selected.size === 0}
            data-testid="add-members-save"
          >
            {saving && <LoadingIcon className="mr-2" />}
            {t("organization.teams.addSelected", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
