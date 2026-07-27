import { Check, ChevronsUpDown } from "lucide-react";
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
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import {
  DESCRIBED_STATUS_CODES,
  parseStatusCode,
  statusShortLabel,
} from "../status";

type Props = {
  /** Selected status code as a string; "" means "all statuses". */
  value: string;
  onChange: (value: string) => void;
};

/**
 * Status-code filter for the access log.
 *
 * The gateway can return any status code, so the well-known codes are only
 * suggestions — typing a code that is not listed (e.g. 418) offers it as a
 * selectable option instead of leaving it unfilterable.
 */
export const StatusCodeFilter = ({ value, onChange }: Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Keep a selected-but-unlisted code (from a previous free-typed pick) in the
  // list so it renders as checked rather than silently missing.
  const selected = parseStatusCode(value);
  const codes = [...DESCRIBED_STATUS_CODES];
  if (selected !== null && !codes.includes(selected)) {
    codes.push(selected);
    codes.sort((a, b) => a - b);
  }

  const typed = parseStatusCode(search);
  const showCustom = typed !== null && !codes.includes(typed);

  const select = (next: string) => {
    onChange(next === value ? "" : next);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid="status-filter"
          className={cn(
            "w-[150px] flex justify-between font-normal",
            !value && "text-muted-foreground",
          )}
        >
          {value || t("ai_traces.filters.allStatuses")}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder={t("ai_traces.filters.statusSearch")}
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{t("ai_traces.filters.statusHint")}</CommandEmpty>
            <CommandGroup>
              {!search && (
                <CommandItem value="all" onSelect={() => select("")}>
                  {t("ai_traces.filters.allStatuses")}
                  <Check
                    className={cn(
                      "ml-auto shrink-0",
                      value ? "opacity-0" : "opacity-100",
                    )}
                  />
                </CommandItem>
              )}
              {showCustom && (
                <CommandItem
                  value={String(typed)}
                  onSelect={() => select(String(typed))}
                >
                  <span className="font-mono">{typed}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">
                    {statusShortLabel(typed, t)}
                  </span>
                  <Check
                    className={cn(
                      "ml-auto shrink-0",
                      value === String(typed) ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              )}
              {codes.map((code) => (
                <CommandItem
                  key={code}
                  value={String(code)}
                  onSelect={() => select(String(code))}
                >
                  <span className="font-mono">{code}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">
                    {statusShortLabel(code, t)}
                  </span>
                  <Check
                    className={cn(
                      "ml-auto shrink-0",
                      value === String(code) ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
