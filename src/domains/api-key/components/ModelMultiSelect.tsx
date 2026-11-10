import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ModelOptionGroups,
  phaseClass,
  useModelOptionMatcher,
  usePhaseLabel,
} from "@/foundation/components/ModelOptionGroups";
import { ModelSourceBadge } from "@/foundation/components/ModelSourceBadge";
import type { WorkspaceModelOption } from "@/foundation/hooks/use-workspace-models";
import { cn } from "@/foundation/lib/utils";

type Option = WorkspaceModelOption;

// Multi-select dropdown for the allowed-models field: pick any number of models
// from one dropdown (no per-row "Add model"); selections show as removable
// chips. Value is the list of selected model names.
export const ModelMultiSelect = ({
  options,
  value,
  onChange,
  placeholder,
  showSelected = true,
}: {
  options: Option[];
  value: string[];
  onChange: (next: Option[]) => void;
  placeholder?: string;
  // Whether to render the selection as chips below the dropdown. Off when the
  // caller shows the selected models as its own rows (each carrying a per-model
  // token limit), so the selection is not listed twice.
  showSelected?: boolean;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = new Set(value);

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(options.filter((option) => next.has(option.value)));
  };
  const optionFor = (v: string) => options.find((o) => o.value === v);
  const phaseLabel = usePhaseLabel();
  const matches = useModelOptionMatcher();

  // cmdk's built-in filter re-orders items by match score, which would discard
  // the Running-first ordering the options already arrive in. Disable it
  // (shouldFilter={false}) and filter here so the incoming order is preserved.
  const query = search.trim();
  const visibleOptions = query
    ? options.filter((o) => matches(o, query))
    : options;

  return (
    <div className="space-y-2">
      {/* modal: this Popover is also used inside the API-key create Dialog, whose
          react-remove-scroll otherwise blocks wheel scrolling on the portaled
          list. A modal Popover installs its own scroll management so the option
          list scrolls. */}
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              value.length === 0 && "text-muted-foreground",
            )}
          >
            <span className="truncate flex-1 text-left">
              {value.length > 0
                ? t("api_keys.limits.modelsSelected", { count: value.length })
                : (placeholder ?? t("api_keys.limits.selectModel"))}
            </span>
            <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] max-w-full p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("api_keys.limits.selectModel")}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-60">
              <CommandEmpty>{t("api_keys.limits.noModels")}</CommandEmpty>
              <ModelOptionGroups
                options={visibleOptions}
                onSelect={(o) => toggle(o.value)}
                trailing={(o) => (
                  <CheckIcon
                    className={cn(
                      "mt-1 ml-auto h-4 w-4",
                      selected.has(o.value) ? "opacity-100" : "opacity-0",
                    )}
                  />
                )}
              />
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {showSelected && value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => {
            const option = optionFor(v);
            return (
              <div
                key={v}
                className="flex max-w-full items-center gap-1.5 rounded-md border bg-muted/40 py-1 pl-2 pr-1"
                title={option ? `${option.model} · ${option.endpointName}` : v}
              >
                {option ? (
                  <>
                    <span className="truncate max-w-[160px] text-xs font-medium">
                      {option.model}
                    </span>
                    <span className="truncate max-w-[120px] text-xs text-muted-foreground">
                      {option.endpointName}
                    </span>
                    <ModelSourceBadge source={option.source} />
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 font-normal",
                        phaseClass(option.phase),
                      )}
                    >
                      {phaseLabel(option.phase)}
                    </Badge>
                  </>
                ) : (
                  <span className="break-all text-xs font-medium">{v}</span>
                )}
                <button
                  type="button"
                  onClick={() => toggle(v)}
                  className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
                  aria-label={t("buttons.delete")}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
