import { type CrudFilter, useList } from "@refinedev/core";
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
import type { IdentitySource } from "@/domains/identity-source/types";
import { useHasPermission } from "@/foundation/hooks/use-has-permission";
import { useTranslation } from "@/foundation/lib/i18n";
import { IDENTITY_SOURCE_NAME_LABEL } from "@/foundation/lib/user-identity";

// PostgREST needs the key quoted: it contains dots.
const SOURCE_FILTER_FIELD = `metadata->labels->>"${IDENTITY_SOURCE_NAME_LABEL}"`;

const ALL = "all";
const LOCAL = "local";

type UserSourceFilterProps = {
  filters: CrudFilter[];
  setFilters: (filters: CrudFilter[], behavior?: "merge" | "replace") => void;
};

const selectedOf = (filters: CrudFilter[]): string => {
  const current = filters.find(
    (filter) => "field" in filter && filter.field === SOURCE_FILTER_FIELD,
  );
  if (!current || !("operator" in current)) return ALL;
  return current.operator === "null" ? LOCAL : String(current.value);
};

/** All users, local users, or the users of one identity source. */
export function UserSourceFilter({
  filters,
  setFilters,
}: UserSourceFilterProps) {
  const { t } = useTranslation();
  // Identity sources are admin-only; without the permission only
  // "all" and "local" are offered.
  const { allowed } = useHasPermission("identity_source:read");
  const { data } = useList<IdentitySource>({
    resource: "identity_sources",
    pagination: { mode: "off" },
    queryOptions: { enabled: allowed === true, staleTime: 60_000 },
  });

  const options = [
    { value: ALL, label: t("components.ui.filter.selectAll") },
    { value: LOCAL, label: t("user_profiles.values.local") },
    ...(data?.data ?? []).map((source) => ({
      value: source.metadata.name,
      label: source.metadata.name,
    })),
  ];
  const selected = selectedOf(filters);
  const selectedLabel =
    options.find((option) => option.value === selected)?.label ?? selected;

  const select = (value: string) => {
    const rest = filters.filter(
      (filter) => !("field" in filter) || filter.field !== SOURCE_FILTER_FIELD,
    );
    if (value === LOCAL) {
      rest.push({
        field: SOURCE_FILTER_FIELD,
        operator: "null",
        value: true,
      });
    } else if (value !== ALL) {
      rest.push({ field: SOURCE_FILTER_FIELD, operator: "eq", value });
    }
    setFilters(rest, "replace");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-8" data-testid="source-filter">
          {selectedLabel}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        <DropdownMenuLabel>
          {t("user_profiles.filters.source")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => select(option.value)}
            className={selected === option.value ? "bg-accent" : ""}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
