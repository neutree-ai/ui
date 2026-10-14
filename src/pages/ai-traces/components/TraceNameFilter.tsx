import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
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
import { cn } from "@/foundation/lib/utils";

// cmdk item values of the no-filter and as-typed entries; the NUL prefix keeps
// them apart from listed names.
const ALL_VALUE = "\u0000all";
const TYPED_PREFIX = "\u0000typed:";

export type NameOption = {
  name: string;
  /** Shown beside the name, to tell apart options that share it. */
  tag?: string;
};

type Props = {
  /** Selected name; "" means no filter. */
  value: string;
  onChange: (value: string) => void;
  /** Names to suggest, in display order. */
  options: NameOption[];
  /** What the filter is, for assistive tech. */
  label: string;
  /** Text of the no-filter entry, also shown on the closed control. */
  allLabel: string;
  searchPlaceholder: string;
  /** Shown under the list, e.g. to say the list is incomplete. */
  notice?: string;
  className?: string;
  "data-testid"?: string;
};

/**
 * Name filter for the access log: pick one of the known names, or type one.
 *
 * The log matches names exactly, so the list narrows by substring as the user
 * types and the pick supplies the full name. Records outlive the endpoint or
 * model they name, so a name that is not listed is offered as typed instead of
 * being unfilterable.
 */
export const TraceNameFilter = ({
  value,
  onChange,
  options,
  label,
  allLabel,
  searchPlaceholder,
  notice,
  className,
  "data-testid": testId,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Keep a selected-but-unlisted name in the list so it renders as checked
  // rather than silently missing.
  const listed = options.some((option) => option.name === value);
  const names = value && !listed ? [{ name: value }, ...options] : options;

  // cmdk's own filter ranks by match score, which would put the as-typed entry
  // ahead of the listed names it is a fallback for. Filter here instead, so the
  // listed matches come first and Enter picks one of them.
  const typed = search.trim();
  const query = typed.toLowerCase();
  const visible = query
    ? names.filter((option) => option.name.toLowerCase().includes(query))
    : names;
  const showTyped =
    typed !== "" && !names.some((option) => option.name === typed);

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
          aria-label={label}
          data-testid={testId}
          className={cn(
            "flex justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {value || allLabel}
          </span>
          <ChevronsUpDown className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandGroup>
              {!query && (
                <CommandItem value={ALL_VALUE} onSelect={() => select("")}>
                  {allLabel}
                  <Check
                    className={cn(
                      "ml-auto shrink-0",
                      value ? "opacity-0" : "opacity-100",
                    )}
                  />
                </CommandItem>
              )}
              {visible.map((option) => (
                <NameItem
                  key={`${option.tag ?? ""}/${option.name}`}
                  value={`${option.tag ?? ""}/${option.name}`}
                  option={option}
                  checked={option.name === value}
                  onSelect={select}
                />
              ))}
              {showTyped && (
                <NameItem
                  value={TYPED_PREFIX + typed}
                  option={{ name: typed }}
                  checked={false}
                  onSelect={select}
                />
              )}
            </CommandGroup>
          </CommandList>
          {notice && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              {notice}
            </p>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const NameItem = ({
  value,
  option,
  checked,
  onSelect,
}: {
  value: string;
  option: NameOption;
  checked: boolean;
  onSelect: (name: string) => void;
}) => (
  <CommandItem value={value} onSelect={() => onSelect(option.name)}>
    <span className="min-w-0 flex-1 truncate">{option.name}</span>
    {option.tag && (
      <span className="shrink-0 text-xs text-muted-foreground">
        {option.tag}
      </span>
    )}
    <Check
      className={cn("ml-auto shrink-0", checked ? "opacity-100" : "opacity-0")}
    />
  </CommandItem>
);
