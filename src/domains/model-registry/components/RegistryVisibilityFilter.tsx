import type { CrudFilter, LogicalFilter } from "@refinedev/core";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  MODEL_REGISTRY_VISIBILITY_FIELD,
  type ModelRegistryVisibility,
} from "@/foundation/lib/model-registry-visibility";

/**
 * Public / private, filtered by the server.
 *
 * `visibility` is a computed field, so this is an ordinary equality filter that
 * PostgREST evaluates — the rows never have to be fetched and sifted here, and
 * the answer agrees with the CLI's, because both are asking the same expression
 * rather than each deciding for themselves what "public" means.
 */

const ALL = "all";

type Props = {
  filters: CrudFilter[];
  setFilters: (filters: CrudFilter[], behavior?: "merge" | "replace") => void;
};

const isVisibilityFilter = (filter: CrudFilter) =>
  "field" in filter && filter.field === MODEL_REGISTRY_VISIBILITY_FIELD;

export const RegistryVisibilityFilter = ({ filters, setFilters }: Props) => {
  const { t } = useTranslation();

  const options: {
    value: ModelRegistryVisibility | typeof ALL;
    label: string;
  }[] = [
    { value: ALL, label: t("components.ui.filter.selectAll") },
    { value: "public", label: t("model_registries.visibility.public") },
    { value: "private", label: t("model_registries.visibility.private") },
  ];

  const current =
    (filters.find(isVisibilityFilter) as LogicalFilter | undefined)?.value ??
    ALL;

  const select = (value: ModelRegistryVisibility | typeof ALL) => {
    const rest = filters.filter((filter) => !isVisibilityFilter(filter));

    setFilters(
      value === ALL
        ? rest
        : [
            ...rest,
            {
              field: MODEL_REGISTRY_VISIBILITY_FIELD,
              operator: "eq",
              value,
            } as LogicalFilter,
          ],
      "replace",
    );
  };

  const label =
    options.find((option) => option.value === current)?.label ??
    options[0].label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-8"
          data-testid="registry-visibility-filter"
        >
          {label}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        <DropdownMenuLabel>
          {t("model_registries.visibility.filterTitle")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => select(option.value)}
            className={current === option.value ? "bg-accent" : ""}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
