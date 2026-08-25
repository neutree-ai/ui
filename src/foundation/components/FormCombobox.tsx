import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import type { BaseOption, BaseRecord } from "@refinedev/core";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
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
};

export const FormCombobox = forwardRef<
  ElementRef<typeof Command>,
  ComboboxProps
>(({ ...props }, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
                ? props.options?.find((option) => option.value === value())
                    ?.label
                : (props.placeholder ?? t("components.ui.combobox.select"))}
            </span>
            <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 text-[var(--nt-text-neutral-tertiary)]" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] max-w-full p-0">
        <Command className="rounded-lg border shadow-md" ref={ref}>
          <CommandInput
            placeholder={t(
              "components.ui.combobox.placeholders.SearchPlaceholder",
            )}
          />
          <CommandList>
            <CommandEmpty>
              {t("components.ui.combobox.messages.noResults")}
            </CommandEmpty>
            <CommandGroup
              heading={t("components.ui.combobox.headings.suggestions")}
            >
              <ScrollArea className="max-h-52 overflow-y-auto">
                {props.options?.map((option) => (
                  <CommandItem
                    value={option.label}
                    key={option.value}
                    disabled={option.disabled}
                    onSelect={() => {
                      if (option.disabled) {
                        return;
                      }
                      props.onChange?.(option.value);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.description && (
                        <span className="block truncate text-xs text-[var(--nt-text-neutral-tertiary)]">
                          {option.description}
                        </span>
                      )}
                    </span>
                    <CheckIcon
                      className={cn(
                        "ml-auto h-4 w-4",
                        option.value === value() ? "opacity-100" : "opacity-0",
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
  );
});

FormCombobox.displayName = "FormCombobox";
