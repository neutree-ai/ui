import { Table } from "..";
import { useTranslation } from "@/lib/i18n";

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
