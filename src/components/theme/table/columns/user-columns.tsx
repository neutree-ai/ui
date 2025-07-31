import { useTranslation } from "@/lib/i18n";
import { Table } from "..";

export const useUserColumns = () => {
  const { t } = useTranslation();

  return {
    email: (
      <Table.Column
        header={t("table.column.email")}
        accessorKey="spec.email"
        id="email"
        enableHiding
      />
    ),
  };
};
