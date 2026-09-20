import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import type { BaseOption, BaseRecord } from "@refinedev/core";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
  type ReactNode,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FormControl } from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

/**
 * One choice, widened from refine's `BaseOption` with the two things a list of
 * live resources needs to say.
 *
 * A disabled option stays in the list: why it cannot be chosen is usually the
 * answer the user came for, and hiding it would leave them hunting for
 * something that appears not to exist.
 */
type FormComboboxOption = BaseOption & {
  disabled?: boolean;
  /** Shown under the label — why the option is disabled, typically. */
  description?: string;
};

type ComboboxProps = ComponentPropsWithoutRef<typeof Command> & {
  options?: FormComboboxOption[];
  placeholder?: string;
  emptyMessage?: string;
  onChange?: (value: string | number) => void;
  // null is not a valid prop value, but FormFieldGroup injects field.value
  // verbatim and the API returns explicit nulls for empty composite fields.
  value?: string | number | BaseRecord | null;
  disabled?: boolean;
  renderOption?: (option: FormComboboxOption) => ReactNode;
  /**
   * Let the user commit whatever they typed as the value, not just pick a
   * listed option.
   *
   * Opt-in, because for most fields the option list IS the contract and a typo
   * would become a silent new value. It is meant for fields whose set of values
   * is genuinely open — where `options` is a set of suggestions (presets plus
   * whatever is already in use) rather than an enumeration.
   *
   * When on, the current value is shown on the trigger even if it is not in
   * `options`; otherwise a custom value would read back as "nothing selected".
   */
  allowCustomValue?: boolean;
};

export const FormCombobox = forwardRef<
  ElementRef<typeof Command>,
  ComboboxProps
>(({ ...props }, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const value = () => {
    if (
      props.value != null &&
      typeof props.value === "object" &&
      "id" in props.value
    ) {
      return (props.value as BaseRecord).id;
    }

    return props.value;
  };

  // The typed text, offered as a value of its own when it is not already one of
  // the options. Matching against `value` (not `label`) is deliberate: options
  // may carry a translated label, and what gets stored is the value.
  const trimmedSearch = search.trim();
  const customValue =
    props.allowCustomValue &&
    trimmedSearch !== "" &&
    !props.options?.some((option) => String(option.value) === trimmedSearch)
      ? trimmedSearch
      : null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Drop a half-typed search so reopening starts from the full list
        // rather than a filter the user has forgotten about.
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <FormControl>
          <Button
            disabled={props.disabled}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between overflow-hidden text-[var(--nt-text-neutral-primary)] hover:bg-[var(--nt-fill-neutral-white)] focus-visible:[box-shadow:var(--nt-outline-active-focus)] disabled:pointer-events-auto disabled:cursor-not-allowed disabled:border-[var(--nt-stroke-neutral-trans-3)] disabled:bg-[var(--nt-fill-neutral-trans-3)] disabled:text-[var(--nt-text-neutral-tertiary)] disabled:opacity-100 disabled:shadow-none disabled:hover:border-[var(--nt-stroke-neutral-trans-3)] disabled:hover:bg-[var(--nt-fill-neutral-trans-3)] disabled:[&_svg]:opacity-50",
              !value() && "text-[var(--nt-text-neutral-quaternary)]",
            )}
          >
            <span className="truncate flex-1 text-left">
              {value()
                ? // A custom value has no option to read a label from; show it
                  // as typed rather than falling through to the placeholder,
                  // which would read as "nothing selected".
                  (props.options?.find((option) => option.value === value())
                    ?.label ??
                  (props.allowCustomValue ? String(value()) : undefined))
                : (props.placeholder ?? t("components.ui.combobox.select"))}
            </span>
            <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 text-[var(--nt-text-neutral-tertiary)]" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] max-w-full p-0">
        <Command className="rounded-lg border shadow-md" ref={ref}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t(
              props.allowCustomValue
                ? "components.ui.combobox.placeholders.SearchOrTypePlaceholder"
                : "components.ui.combobox.placeholders.SearchPlaceholder",
            )}
          />
          <CommandList>
            <CommandEmpty>
              {t("components.ui.combobox.messages.noResults")}
            </CommandEmpty>
            {customValue && (
              <CommandGroup>
                <CommandItem
                  // cmdk filters items by this value against the search text;
                  // using the search itself keeps the row from filtering
                  // itself out.
                  value={customValue}
                  onSelect={() => {
                    props.onChange?.(customValue);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {t("components.ui.combobox.useCustomValue", {
                      value: customValue,
                    })}
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup
              heading={t("components.ui.combobox.headings.suggestions")}
            >
              <ScrollArea className="max-h-52 overflow-y-auto">
                {props.options?.map((option) => {
                  // One condition drives both halves. Deriving the check icon
                  // from `renderOption` while the content used `?? ` meant a
                  // renderer returning null fell back to the default row but
                  // still lost its check.
                  const hasCustomOption = Boolean(props.renderOption);
                  const isSelected = option.value === value();

                  return (
                    <CommandItem
                      value={option.label}
                      key={option.value}
                      disabled={option.disabled}
                      // cmdk's `data-selected` is the keyboard cursor, not the
                      // stored value — on open it lands on the first row. A
                      // custom row drops the check icon, so without this the
                      // list shows nothing at all for the current value.
                      className={cn(
                        hasCustomOption &&
                          isSelected &&
                          "bg-[var(--nt-fill-outstanding-light)] text-[var(--nt-text-colorful-outstanding)] data-[selected=true]:bg-[var(--nt-fill-outstanding-lighthover)] data-[selected=true]:text-[var(--nt-text-colorful-outstanding)]",
                      )}
                      onSelect={() => {
                        if (option.disabled) {
                          return;
                        }
                        props.onChange?.(option.value);
                        setOpen(false);
                      }}
                    >
                      {hasCustomOption ? (
                        props.renderOption?.(option)
                      ) : (
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{option.label}</span>
                          {option.description && (
                            <span className="block truncate text-xs text-[var(--nt-text-neutral-tertiary)]">
                              {option.description}
                            </span>
                          )}
                        </span>
                      )}
                      {hasCustomOption ? null : (
                        <CheckIcon
                          data-testid="combobox-option-check"
                          className={cn(
                            "ml-auto h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                      )}
                    </CommandItem>
                  );
                })}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

FormCombobox.displayName = "FormCombobox";
