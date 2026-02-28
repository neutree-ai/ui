import { Table } from "@/components/business/Table";
import { useTranslation } from "@/lib/i18n";

export const useUserColumns = () => {
  const { t } = useTranslation();

  return {
    email: (
      <Table.Column
        header={t("common.fields.email")}
        accessorKey="spec.email"
        id="email"
        enableHiding
      />
    ),
  };
};
