import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
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
import type { WorkspaceModelOption } from "@/domains/api-key/hooks/use-api-key-policy";
import { cn } from "@/foundation/lib/utils";

type Option = WorkspaceModelOption;

const phaseClass = (phase: string | null) =>
  ({
    Running: "border-green-200 bg-green-50 text-green-700",
    Failed: "border-red-200 bg-red-50 text-red-700",
    Pending: "border-yellow-200 bg-yellow-50 text-yellow-700",
    Deploying: "border-blue-200 bg-blue-50 text-blue-700",
    ModelDownloading: "border-cyan-200 bg-cyan-50 text-cyan-700",
    Deleting: "border-orange-200 bg-orange-50 text-orange-700",
    Paused: "border-yellow-200 bg-yellow-50 text-yellow-700",
    Deleted: "border-gray-200 bg-gray-50 text-gray-700",
  })[phase ?? ""] ?? "border-muted bg-muted text-muted-foreground";

// Multi-select dropdown for the allowed-models field: pick any number of models
// from one dropdown (no per-row "Add model"); selections show as removable
// chips. Value is the list of selected model names.
export const ModelMultiSelect = ({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: Option[];
  value: string[];
  onChange: (next: Option[]) => void;
  placeholder?: string;
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
  const phaseLabel = (phase: string | null) =>
    phase ? t(`status.phases.endpoint.${phase}`) : t("api_keys.models.unknown");
  const typeLabel = (type: Option["type"]) =>
    type === "external"
      ? t("api_keys.models.external")
      : t("api_keys.models.internal");

  // cmdk's built-in filter re-orders items by match score, which would discard
  // the Running-first ordering the options already arrive in. Disable it
  // (shouldFilter={false}) and filter here so the incoming order is preserved.
  const query = search.trim().toLowerCase();
  const visibleOptions = query
    ? options.filter((o) =>
        `${o.model} ${o.endpointName} ${typeLabel(o.type)} ${phaseLabel(o.phase)}`
          .toLowerCase()
          .includes(query),
      )
    : options;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
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
        <PopoverContent className="w-[400px] max-w-full p-0">
          <Command shouldFilter={false} className="rounded-lg border shadow-md">
            <CommandInput
              placeholder={t("api_keys.limits.selectModel")}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-60">
              <CommandEmpty>{t("api_keys.limits.noModels")}</CommandEmpty>
              <CommandGroup>
                {visibleOptions.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.value}
                    onSelect={() => toggle(o.value)}
                    className="group items-start gap-2"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="truncate text-sm font-medium">
                        {o.model}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground">
                        <span className="truncate max-w-[180px]">
                          {o.endpointName}
                        </span>
                        <Badge
                          variant="outline"
                          className="h-5 bg-background/80 font-normal group-data-[selected=true]:border-accent-foreground/30 group-data-[selected=true]:bg-background group-data-[selected=true]:text-foreground"
                        >
                          {typeLabel(o.type)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 font-normal",
                            phaseClass(o.phase),
                            "group-data-[selected=true]:border-accent-foreground/30 group-data-[selected=true]:bg-background group-data-[selected=true]:text-foreground",
                          )}
                        >
                          {phaseLabel(o.phase)}
                        </Badge>
                      </div>
                    </div>
                    <CheckIcon
                      className={cn(
                        "mt-1 ml-auto h-4 w-4",
                        selected.has(o.value) ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => {
            const option = optionFor(v);
            return (
              <Badge
                key={v}
                variant="secondary"
                className="max-w-full gap-1 pr-1"
              >
                <span
                  className="break-all whitespace-normal"
                  title={
                    option ? `${option.model} · ${option.endpointName}` : v
                  }
                >
                  {option ? `${option.model} · ${option.endpointName}` : v}
                </span>
                {option && (
                  <span className="text-muted-foreground">
                    {typeLabel(option.type)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggle(v)}
                  className="rounded-sm hover:bg-muted-foreground/20"
                  aria-label={t("buttons.delete")}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};
