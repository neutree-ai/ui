import { useShow } from "@refinedev/core";
import UserCell from "@/domains/role-assignment/components/UserCell";
import type { Workspace } from "@/domains/workspace/types";
import { Loader } from "@/foundation/components/Loader";
import { MetadataDisclosure } from "@/foundation/components/MetadataDisclosure";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import { Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";

export const WorkspacesShow = () => {
  const {
    query: { data, isLoading },
  } = useShow<Workspace>();
  const record = data?.data;
  const metadataColumns = useMetadataColumns({ resource: "role_assignments" });
  const { t } = useTranslation();

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const { metadata } = record;

  return (
    <ShowPage record={record} canEdit={false} showCurrentBreadcrumb={false}>
      <ShowPage.ObjectHeader
        title={metadata.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <MetadataTimestampMeta metadata={metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-4">
        <MetadataDisclosure metadata={metadata} />
        <ShowPage.Section title={t("role_assignments.title")}>
          <Table
            refineCoreProps={{
              resource: "role_assignments",
              filters: {
                permanent: [
                  {
                    field: "spec->workspace",
                    operator: "eq",
                    value: JSON.stringify(record.metadata.name),
                  },
                ],
              },
            }}
          >
            {metadataColumns.name}
            <Table.Column
              header={t("common.fields.role")}
              accessorKey="spec.role"
              id="role"
              enableHiding
              cell={({ row }) => {
                const { role } = row.original.spec;
                return (
                  <ShowButton
                    recordItemId={role}
                    meta={{}}
                    variant="link"
                    resource="roles"
                  >
                    {role}
                  </ShowButton>
                );
              }}
            />
            <Table.Column
              header={t("common.fields.user")}
              accessorKey="spec.user_id"
              id="user"
              enableHiding
              cell={({ row }) => <UserCell id={row.original.spec.user_id} />}
            />
            {metadataColumns.update_timestamp}
            {metadataColumns.creation_timestamp}
          </Table>
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
