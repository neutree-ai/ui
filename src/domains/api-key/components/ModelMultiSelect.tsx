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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/foundation/lib/utils";

type Option = { value: string; label: string };

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
  onChange: (next: string[]) => void;
  placeholder?: string;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = new Set(value);

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange([...next]);
  };
  const labelFor = (v: string) =>
    options.find((o) => o.value === v)?.label ?? v;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            // biome-ignore lint/a11y/useSemanticElements: follow shadcn-ui combobox
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
          <Command className="rounded-lg border shadow-md">
            <CommandInput placeholder={t("api_keys.limits.selectModel")} />
            <CommandList>
              <CommandEmpty>{t("api_keys.limits.noModels")}</CommandEmpty>
              <CommandGroup>
                <ScrollArea className="max-h-52 overflow-y-auto">
                  {options.map((o) => (
                    <CommandItem
                      key={o.value}
                      value={o.label}
                      onSelect={() => toggle(o.value)}
                    >
                      {o.label}
                      <CheckIcon
                        className={cn(
                          "ml-auto h-4 w-4",
                          selected.has(o.value) ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              <span className="truncate max-w-[220px]">{labelFor(v)}</span>
              <button
                type="button"
                onClick={() => toggle(v)}
                className="rounded-sm hover:bg-muted-foreground/20"
                aria-label={t("buttons.delete")}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
