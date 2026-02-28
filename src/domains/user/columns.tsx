import { Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";

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
