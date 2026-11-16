import { CaretSortIcon } from "@radix-ui/react-icons";
import { Check } from "lucide-react";
import { forwardRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ProjectBadge } from "@/domains/organization/components/ProjectBadge";
import { useTeamsByName } from "@/domains/organization/hooks/use-organization";
import { isManualTeam, isProjectTeam } from "@/domains/organization/lib/team";
import { displayName } from "@/foundation/lib/display-name";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

type ManualTeamsFieldProps = {
  /** metadata.name of each selected Team. */
  value?: string[] | null;
  onChange?: (value: string[]) => void;
  disabled?: boolean;
};

/**
 * A form field that picks any number of Teams and scenarios created in
 * Neutree, by metadata.name. Synced Teams are not listed: their members come
 * from the identity source.
 */
export const ManualTeamsField = forwardRef<
  HTMLButtonElement,
  ManualTeamsFieldProps
>(({ value, onChange, disabled }, ref) => {
  const { t } = useTranslation();
  const { list, isLoading } = useTeamsByName();
  const [open, setOpen] = useState(false);
  const manual = list.filter(isManualTeam);
  const selected = value ?? [];
  const labels = manual
    .filter((team) => selected.includes(team.metadata.name))
    .map((team) => displayName(team.metadata));

  const toggle = (name: string) =>
    onChange?.(
      selected.includes(name)
        ? selected.filter((item) => item !== name)
        : [...selected, name],
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className="w-full justify-between overflow-hidden font-normal"
          data-testid="manual-teams-field"
        >
          <span
            className={cn(
              "flex-1 truncate text-left",
              labels.length === 0 && "text-muted-foreground",
            )}
          >
            {labels.length
              ? labels.join(", ")
              : t("organization.teamsPicker.placeholder")}
          </span>
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] max-w-full p-0">
        <Command className="rounded-lg border shadow-md">
          <CommandInput placeholder={t("organization.filters.searchTeams")} />
          <CommandList>
            <CommandEmpty>{t("organization.teamsPicker.empty")}</CommandEmpty>
            {manual.map((team) => {
              const on = selected.includes(team.metadata.name);
              return (
                <CommandItem
                  key={team.id}
                  value={displayName(team.metadata)}
                  aria-checked={on}
                  onSelect={() => toggle(team.metadata.name)}
                  data-testid={`manual-team-option-${team.metadata.name}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      on ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{displayName(team.metadata)}</span>
                  {isProjectTeam(team) && <ProjectBadge />}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

ManualTeamsField.displayName = "ManualTeamsField";
