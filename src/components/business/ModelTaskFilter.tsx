import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CrudFilter, LogicalFilter } from "@refinedev/core";
import { ChevronDown } from "lucide-react";
import { useMemo } from "react";
import type { TableListFilterOption } from "../theme";

interface ModelTaskFilterProps {
  filters: CrudFilter[];
  setFilters: (filters: CrudFilter[], behavior?: "merge" | "replace") => void;
}

const MODEL_TASK_OPTIONS: TableListFilterOption[] = [
  {
    label: "All",
    value: "all",
  },
  {
    label: "Text Generation",
    value: "text-generation",
  },
  {
    label: "Text Embedding",
    value: "text-embedding",
  },
  {
    label: "Text Rerank",
    value: "text-rerank",
  },
].map((o) => ({
  ...o,
  value: JSON.stringify(o.value),
}));

export function ModelTaskFilter({ filters, setFilters }: ModelTaskFilterProps) {
  // Find the current task filter
  const taskFilter = useMemo(() => {
    return filters.find(
      (filter: CrudFilter) =>
        "field" in filter &&
        (filter.field === "spec->model->>task" || filter.field === "task"),
    ) as LogicalFilter | undefined;
  }, [filters]);

  const selectedValues = useMemo(() => {
    if (!taskFilter?.value) return [];
    return Array.isArray(taskFilter.value)
      ? taskFilter.value
      : [taskFilter.value];
  }, [taskFilter]);

  const selectedTask = useMemo(() => {
    if (selectedValues.length === 0) return MODEL_TASK_OPTIONS[0].value;
    return selectedValues[0];
  }, [selectedValues]);

  const selectedTaskLabel = useMemo(() => {
    const option = MODEL_TASK_OPTIONS.find((opt) => opt.value === selectedTask);
    return option?.label || MODEL_TASK_OPTIONS[0].label;
  }, [selectedTask]);

  const handleValueChange = (value: string) => {
    // Create or update the filter
    const newFilters = filters.filter(
      (filter: CrudFilter) =>
        !("field" in filter) ||
        (filter.field !== "spec->model->>task" && filter.field !== "task"),
    );

    // If "all" is selected, don't add any filter
    if (value !== MODEL_TASK_OPTIONS[0].value) {
      newFilters.push({
        field: "spec->model->>task",
        operator: "in",
        value: [value],
      } as LogicalFilter);
    }

    setFilters(newFilters, "replace");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {selectedTaskLabel}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        <DropdownMenuLabel>Filter by Task</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MODEL_TASK_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleValueChange(option.value)}
            className={selectedTask === option.value ? "bg-accent" : ""}
          >
            <div className="flex items-center space-x-2">
              {option.icon && (
                <option.icon className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{option.label}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
