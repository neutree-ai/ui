import {
  CalendarIcon,
  EnvelopeClosedIcon,
  FaceIcon,
  GearIcon,
  PersonIcon,
  RocketIcon,
} from "@radix-ui/react-icons";
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type {
  BaseOption,
  BaseRecord,
  UseSelectReturnType,
} from "@refinedev/core";
import {
  type ComponentPropsWithoutRef,
  forwardRef,
  useState,
  type ElementRef,
} from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FormControl } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type ComboboxProps = ComponentPropsWithoutRef<typeof Command> &
  Pick<UseSelectReturnType<BaseOption, any>, "options"> & {
    placeholder?: string;
    emptyMessage?: string;
    onChange?: (value: string | number) => void;
    value?: string | number | BaseRecord;
    disabled?: boolean;
  };

export const Combobox = forwardRef<ElementRef<typeof Command>, ComboboxProps>(
  ({ ...props }, ref) => {
    const [open, setOpen] = useState(false);

    const value = () => {
      if (typeof props.value === "object" && "id" in props.value) {
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
              // biome-ignore lint/a11y/useSemanticElements: follow shadcn-ui
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full flex justify-between",
                !value() && "text-muted-foreground",
              )}
            >
              {value()
                ? props.options?.find((option) => option.value === value())
                    ?.label
                : (props.placeholder ?? "Select")}
              <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] max-w-full p-0">
          <Command className="rounded-lg border shadow-md" ref={ref}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Suggestions">
                <ScrollArea className="max-h-52 overflow-y-auto">
                  {props.options?.map((option) => (
                    <CommandItem
                      value={option.label}
                      key={option.value}
                      onSelect={() => {
                        props.onChange?.(option.value);
                        setOpen(false);
                      }}
                    >
                      {option.label}
                      <CheckIcon
                        className={cn(
                          "ml-auto h-4 w-4",
                          option.value === value()
                            ? "opacity-100"
                            : "opacity-0",
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
  },
);

Combobox.displayName = "Combobox";
