import { CaretSortIcon, CheckIcon, PlusIcon } from "@radix-ui/react-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Project } from "@/domains/api-key/types";
import { cn } from "@/foundation/lib/utils";
import { useState } from "react";

type ProjectPickerProps = {
  projects: Project[];
  value?: string | null;
  onChange?: (id: string | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  canCreate?: boolean;
  onRequestCreate?: () => void;
};

/**
 * Searchable Project selector used by the API key creation form and the
 * migration dialog. Disabled Projects stay visible but cannot be selected;
 * the footer entry asks the parent to open its inline create area.
 */
export const ProjectPicker = ({
  projects,
  value,
  onChange,
  onBlur,
  disabled,
  placeholder = "Select Project",
  canCreate = false,
  onRequestCreate,
}: ProjectPickerProps) => {
  const [open, setOpen] = useState(false);
  const selected = projects.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          onBlur={onBlur}
          className="w-full justify-between overflow-hidden"
        >
          <span
            className={cn(
              "truncate flex-1 text-left",
              !selected && "text-muted-foreground",
            )}
          >
            {selected ? selected.name : placeholder}
          </span>
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] max-w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search Project" />
          <CommandList>
            <CommandEmpty>No projects found</CommandEmpty>
            <CommandGroup heading="Projects">
              <ScrollArea className="max-h-52 overflow-y-auto">
                {projects.map((project) => {
                  const selectable = project.status === "enabled";
                  return (
                    <CommandItem
                      key={project.id}
                      value={project.name}
                      disabled={!selectable}
                      onSelect={() => {
                        if (selectable) {
                          onChange?.(project.id);
                          setOpen(false);
                        }
                      }}
                      className={cn(!selectable && "opacity-60")}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">
                          {project.name}
                        </span>
                        {project.description ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {project.description}
                          </span>
                        ) : null}
                      </div>
                      {!selectable && (
                        <Badge variant="secondary" className="ml-2 shrink-0">
                          Disabled
                        </Badge>
                      )}
                      {selectable && value === project.id && (
                        <CheckIcon className="ml-2 h-4 w-4 shrink-0" />
                      )}
                    </CommandItem>
                  );
                })}
              </ScrollArea>
            </CommandGroup>
            <CommandSeparator />
            {canCreate && (
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  onRequestCreate?.();
                }}
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                + Create Project
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
