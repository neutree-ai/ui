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
import { modelRegistryTypeOptions } from "@/domains/model-registry/components/ModelRegistryType";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * Narrows the list to one kind of registry, filtered by the server.
 *
 * `spec` is a composite column, not JSON, and PostgREST addresses a composite's
 * attributes with the same arrow syntax it uses for JSON — so the predicate goes
 * over the wire as `spec->>type=eq.<kind>` and Postgres evaluates it. That
 * matters more than it looks: the row count in `Content-Range` is then computed
 * against the same predicate, so paging and the total agree with what is on
 * screen. Sifting the fetched page here instead would leave both wrong, which is
 * the mistake this list already made once.
 *
 * Reading `spec.type` is allowed here because a filter is a query the user
 * asked for, not a judgement about what a registry can do. Those still come
 * from what the server reported — see `@/foundation/lib/model-registry-visibility`
 * and `../lib/capabilities`.
 */

/** The column path PostgREST filters on. `->>` yields text, which is what an
 * equality against a kind name compares against. */
const TYPE_FIELD = "spec->>type";

const ALL = "all";

type Props = {
  filters: CrudFilter[];
  setFilters: (filters: CrudFilter[], behavior?: "merge" | "replace") => void;
};

const isTypeFilter = (filter: CrudFilter) =>
  "field" in filter && filter.field === TYPE_FIELD;

export const RegistryTypeFilter = ({ filters, setFilters }: Props) => {
  const { t } = useTranslation();

  const options = [
    { value: ALL, label: t("components.ui.filter.selectAll") },
    ...modelRegistryTypeOptions(t),
  ];

  const current =
    (filters.find(isTypeFilter) as LogicalFilter | undefined)?.value ?? ALL;

  const select = (value: string) => {
    const rest = filters.filter((filter) => !isTypeFilter(filter));

    setFilters(
      value === ALL
        ? rest
        : [
            ...rest,
            { field: TYPE_FIELD, operator: "eq", value } as LogicalFilter,
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
          data-testid="registry-type-filter"
        >
          {label}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        <DropdownMenuLabel>
          {t("model_registries.types.filterTitle")}
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
