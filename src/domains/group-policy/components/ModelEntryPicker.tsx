import { CaretSortIcon, PlusIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type ModelCandidateSource,
  useModelCandidates,
} from "@/domains/group-policy/hooks/use-group-policies";
import { useWorkspaceOptions } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";

const ALL = "__all__";

/**
 * Adds entries to one policy list: pick the workspace scope, then a model.
 * Models are suggested from the workspace (from every workspace for "all");
 * any typed name can be added, since a model may be deployed later.
 */
export function ModelEntryPicker({
  onAdd,
  "data-testid": testId,
}: {
  onAdd: (model: string, workspace: string) => void;
  "data-testid"?: string;
}) {
  const { t } = useTranslation();
  const [scope, setScope] = useState(ALL);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { workspaces } = useWorkspaceOptions();
  const workspaceNames = workspaces.map(
    (workspace) => workspace.metadata.name as string,
  );
  const candidates = useModelCandidates(
    scope === ALL ? workspaceNames : [scope],
  );

  const query = search.trim();
  const visible = query
    ? candidates.filter(({ model }) =>
        model.toLowerCase().includes(query.toLowerCase()),
      )
    : candidates;
  const canAddTyped =
    query !== "" && !candidates.some(({ model }) => model === query);

  const add = (model: string) => {
    onAdd(model, scope === ALL ? "" : scope);
    setSearch("");
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row" data-testid={testId}>
      <Select value={scope} onValueChange={setScope}>
        <SelectTrigger
          className="sm:w-48"
          aria-label={t("common.fields.workspace")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>
            {t("group_policies.allWorkspaces")}
          </SelectItem>
          {workspaceNames.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between text-muted-foreground"
          >
            <span className="truncate">{t("group_policies.addModel")}</span>
            <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("group_policies.searchModel")}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-60">
              <CommandEmpty>{t("group_policies.noModels")}</CommandEmpty>
              {canAddTyped && (
                <CommandGroup>
                  <CommandItem
                    value={`typed:${query}`}
                    onSelect={() => add(query)}
                  >
                    <PlusIcon className="mr-2 h-4 w-4" />
                    {t("group_policies.addTyped", { model: query })}
                  </CommandItem>
                </CommandGroup>
              )}
              {visible.length > 0 && (
                <CommandGroup>
                  {visible.map(({ model, sources }) => (
                    <CommandItem
                      key={model}
                      value={model}
                      onSelect={() => add(model)}
                      className="gap-2"
                    >
                      <span className="min-w-0 flex-1 truncate">{model}</span>
                      <ModelSources sources={sources} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** The endpoint and workspace a model comes from; several collapse to a count. */
function ModelSources({ sources }: { sources: ModelCandidateSource[] }) {
  const { t } = useTranslation();
  if (!sources.length) return null;
  const label = (source: ModelCandidateSource) =>
    t(
      source.external
        ? "group_policies.source.external"
        : "group_policies.source.endpoint",
      { name: source.endpoint, workspace: source.workspace },
    );
  if (sources.length === 1) {
    return (
      <span
        className="max-w-[60%] shrink-0 truncate text-xs text-muted-foreground"
        data-testid="model-source"
      >
        {label(sources[0])}
      </span>
    );
  }
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="shrink-0 text-xs text-muted-foreground underline decoration-dotted underline-offset-2"
            data-testid="model-source"
          >
            {t("group_policies.source.count", { count: sources.length })}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          <ul className="space-y-0.5">
            {sources.map((source) => (
              <li
                key={`${source.workspace}/${source.external}/${source.endpoint}`}
              >
                {label(source)}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
