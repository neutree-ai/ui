import type { UseTableReturnType } from "@refinedev/react-table";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/foundation/lib/i18n";

interface TableSearchProps {
  field: string;
  table: UseTableReturnType<any, any>;
}

export function TableSearch({ field, table }: TableSearchProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const applyFilter = useCallback(
    (search: string) => {
      table.refineCore.setFilters([
        {
          field,
          operator: "contains",
          value: search || undefined,
        },
      ]);
    },
    [table, field],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => applyFilter(v), 300);
    },
    [applyFilter],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={t("table.searchPlaceholder")}
        value={value}
        onChange={handleChange}
        className="h-9 w-[200px] pl-8"
        data-testid="table-search"
      />
    </div>
  );
}
