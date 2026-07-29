import { Check, ChevronsUpDown } from "lucide-react";
import { type ElementRef, forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Command,
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
import { cn } from "@/foundation/lib/utils";

type ComboboxProps = {
  value?: string;
  onChange?: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  shouldFilter?: boolean;
  onSearchChange?: (search: string) => void;
  loading?: React.ReactNode;
  triggerClassName?: string;
  popoverClassName?: string;
  allowUnselect?: boolean;
  disabled?: boolean;
  asField?: boolean;
};

export const Combobox = forwardRef<ElementRef<typeof Command>, ComboboxProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder,
      allowUnselect = true,
      shouldFilter,
      loading,
      onSearchChange,
      triggerClassName,
      popoverClassName,
      disabled,
      asField = true,
    }: ComboboxProps,
    ref,
  ) => {
    const [open, setOpen] = useState(false);
    const { t } = useTranslation();
    const defaultPlaceholder =
      placeholder || t("components.ui.combobox.select");

    const trigger = (
      <Button
        type="button"
        variant="outline"
        // biome-ignore lint/a11y/useSemanticElements: follow shadcn-ui
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          "w-full flex justify-between overflow-clip text-[var(--nt-text-neutral-primary)] hover:bg-[var(--nt-fill-neutral-white)] focus-visible:[box-shadow:var(--nt-outline-active-focus)] disabled:pointer-events-auto disabled:cursor-not-allowed disabled:border-[var(--nt-stroke-neutral-trans-3)] disabled:bg-[var(--nt-fill-neutral-trans-3)] disabled:text-[var(--nt-text-neutral-tertiary)] disabled:opacity-100 disabled:shadow-none disabled:hover:border-[var(--nt-stroke-neutral-trans-3)] disabled:hover:bg-[var(--nt-fill-neutral-trans-3)] disabled:[&_svg]:opacity-50",
          !value && "text-[var(--nt-text-neutral-quaternary)]",
          triggerClassName,
        )}
      >
        {value
          ? (options.find((item) => item.value === value)?.label ?? value)
          : defaultPlaceholder}
        <ChevronsUpDown className="text-[var(--nt-text-neutral-tertiary)]" />
      </Button>
    );

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger disabled={disabled} asChild>
          {asField ? <FormControl>{trigger}</FormControl> : trigger}
        </PopoverTrigger>
        <PopoverContent className={cn("w-[400px] p-0", popoverClassName)}>
          <Command
            className="border border-[var(--nt-stroke-neutral-trans-2)] shadow-[var(--nt-effect-menu-shadow-default)]"
            ref={ref}
            shouldFilter={shouldFilter}
          >
            <CommandInput
              placeholder={defaultPlaceholder}
              className="h-9"
              onValueChange={onSearchChange}
            />
            <CommandList>
              {loading || (
                <CommandGroup>
                  {options.map((item) => (
                    <CommandItem
                      key={item.value}
                      value={item.value}
                      onSelect={(currentValue) => {
                        if (!allowUnselect && currentValue === value) {
                          return;
                        }
                        onChange?.(currentValue === value ? "" : currentValue);
                        setOpen(false);
                      }}
                    >
                      {item.label}
                      <Check
                        className={cn(
                          "ml-auto",
                          value === item.value ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);
