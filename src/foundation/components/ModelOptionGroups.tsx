import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { endpointPhaseClassMapping } from "@/foundation/components/EndpointStatus";
import { useModelSourceLabel } from "@/foundation/components/ModelSourceBadge";
import type { WorkspaceModelOption } from "@/foundation/hooks/use-workspace-models";
import { cn } from "@/foundation/lib/utils";

export const phaseClass = (phase: string | null) =>
  endpointPhaseClassMapping[phase ?? ""] ?? endpointPhaseClassMapping.Deleted;

export const usePhaseLabel = () => {
  const { t } = useTranslation();
  return (phase: string | null) =>
    phase ? t(`status.phases.endpoint.${phase}`) : t("api_keys.models.unknown");
};

/** Whether an option matches a search, on everything the row shows. */
export const useModelOptionMatcher = () => {
  const sourceLabel = useModelSourceLabel();
  const phaseLabel = usePhaseLabel();
  return (option: WorkspaceModelOption, query: string) =>
    `${option.model} ${option.endpointName} ${option.workspace ?? ""} ${sourceLabel(option.source)} ${phaseLabel(option.phase)}`
      .toLowerCase()
      .includes(query.toLowerCase());
};

/** Picker options, one section per source (options arrive sorted by source). */
export function ModelOptionGroups({
  options,
  onSelect,
  trailing,
  showWorkspace = false,
}: {
  options: WorkspaceModelOption[];
  onSelect: (option: WorkspaceModelOption) => void;
  trailing?: (option: WorkspaceModelOption) => ReactNode;
  showWorkspace?: boolean;
}) {
  const sourceLabel = useModelSourceLabel();
  const phaseLabel = usePhaseLabel();

  const groups: {
    source: WorkspaceModelOption["source"];
    options: WorkspaceModelOption[];
  }[] = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (last && last.source === option.source) last.options.push(option);
    else groups.push({ source: option.source, options: [option] });
  }

  return (
    <>
      {groups.map((group) => (
        <CommandGroup
          key={group.source ?? "__unspecified__"}
          heading={sourceLabel(group.source)}
        >
          {group.options.map((o) => {
            const key = `${o.workspace ?? ""}/${o.value}`;
            return (
              <CommandItem
                key={key}
                value={key}
                onSelect={() => onSelect(o)}
                className="group items-start gap-2"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="truncate text-sm font-medium">{o.model}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground">
                    <span className="truncate max-w-[180px]">
                      {showWorkspace && o.workspace
                        ? `${o.endpointName} · ${o.workspace}`
                        : o.endpointName}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("h-5 font-normal", phaseClass(o.phase))}
                    >
                      {phaseLabel(o.phase)}
                    </Badge>
                  </div>
                </div>
                {trailing?.(o)}
              </CommandItem>
            );
          })}
        </CommandGroup>
      ))}
    </>
  );
}
