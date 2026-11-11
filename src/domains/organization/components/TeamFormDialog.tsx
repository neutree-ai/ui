import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingIcon } from "@/components/ui/loading";
import { Switch } from "@/components/ui/switch";
import {
  isProjectTeam,
  type TeamNameError,
  validateTeamName,
} from "@/domains/organization/lib/team";
import type { Team, TeamFormValues } from "@/domains/organization/types";
import { useTranslation } from "@/foundation/lib/i18n";

const NAME_ERROR_KEYS: Record<TeamNameError, string> = {
  required: "organization.teams.validation.nameRequired",
  format: "organization.teams.validation.nameFormat",
  tooLong: "organization.teams.validation.nameTooLong",
  reserved: "organization.errors.reservedTeamName",
};

type TeamFormDialogProps = {
  onOpenChange: (open: boolean) => void;
  /** The Team to edit; a new Team when absent. */
  team?: Team;
  /** Whether a new Team starts marked as a scenario. */
  initialProject?: boolean;
  saving?: boolean;
  error?: string;
  onSave: (values: TeamFormValues) => void;
};

/**
 * Creates a manual Team, or changes its display name and project mark: the
 * name is fixed once created. Mount it when opening.
 */
export function TeamFormDialog({
  onOpenChange,
  team,
  initialProject = false,
  saving,
  error,
  onSave,
}: TeamFormDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(team?.metadata.name ?? "");
  const [displayName, setDisplayName] = useState(
    team?.metadata.display_name ?? "",
  );
  const [project, setProject] = useState(
    team ? isProjectTeam(team) : initialProject,
  );
  // Blur marks the name touched only once edited: opening the dialog may move
  // focus through the field before the user types.
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState(false);

  const nameError = team ? undefined : validateTeamName(name.trim());
  const unchanged =
    !!team &&
    displayName.trim() === (team.metadata.display_name ?? "").trim() &&
    project === isProjectTeam(team);

  const submit = () => {
    setTouched(true);
    if (nameError || unchanged) return;
    onSave({ name: name.trim(), displayName: displayName.trim(), project });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            hint={
              team
                ? t("organization.teams.editHint")
                : t("organization.teams.createHint")
            }
          >
            {team
              ? t("organization.teams.editTitle")
              : project
                ? t("organization.teams.createScenario")
                : t("organization.teams.createTitle")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="team-name">{t("common.fields.name")}</Label>
            <Input
              id="team-name"
              value={name}
              disabled={!!team}
              onChange={(event) => {
                setName(event.target.value);
                setDirty(true);
              }}
              onBlur={() => dirty && setTouched(true)}
              placeholder={t("organization.teams.namePlaceholder")}
              data-testid="team-form-name"
            />
            {touched && nameError ? (
              <p className="text-sm text-destructive">
                {t(NAME_ERROR_KEYS[nameError], { hint: "" })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {team
                  ? t("organization.teams.nameFixed")
                  : t("organization.teams.nameHint")}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-display-name">
              {t("organization.fields.displayName")}
            </Label>
            <Input
              id="team-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={t("organization.teams.displayNamePlaceholder")}
              data-testid="team-form-display-name"
            />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="team-project">
                {t("organization.teams.markProject")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("organization.teams.markProjectHint")}
              </p>
            </div>
            <Switch
              id="team-project"
              checked={project}
              onCheckedChange={setProject}
              data-testid="team-form-project"
            />
          </div>
          {error && (
            <Alert variant="destructive" data-testid="team-form-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t("buttons.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={saving || (touched && !!nameError) || unchanged}
              data-testid="team-form-save"
            >
              {saving && <LoadingIcon className="mr-2" />}
              {team ? t("buttons.save") : t("buttons.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
