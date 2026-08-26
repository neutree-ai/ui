import { useShow } from "@refinedev/core";
import type { UserProfile } from "@/domains/user/types";
import { Loader } from "@/foundation/components/Loader";
import { MetadataDisclosure } from "@/foundation/components/MetadataDisclosure";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import { Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";

export const UsersShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<UserProfile>();
  const record = data?.data;

  const metadataColumns = useMetadataColumns();

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  return (
    <ShowPage record={record} showCurrentBreadcrumb={false}>
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <ShowPage.Meta label={t("common.fields.email")}>
              {record.spec.email}
            </ShowPage.Meta>
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
        <MetadataDisclosure metadata={record.metadata} />
        <ShowPage.Section
          title={t("user_profiles.sections.globalRoles")}
          data-testid="global-roles-card"
        >
          <Table
            refineCoreProps={{
              resource: "role_assignments",
              filters: {
                permanent: [
                  {
                    field: "spec->user_id",
                    operator: "eq",
                    value: JSON.stringify(record.id),
                  },
                  {
                    field: "spec->global",
                    operator: "eq",
                    value: true,
                  },
                ],
              },
            }}
          >
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
            {metadataColumns.creation_timestamp}
          </Table>
        </ShowPage.Section>
        <ShowPage.Section title={t("user_profiles.sections.joinedWorkspaces")}>
          <Table
            refineCoreProps={{
              resource: "role_assignments",
              filters: {
                permanent: [
                  {
                    field: "spec->user_id",
                    operator: "eq",
                    value: JSON.stringify(record.id),
                  },
                  {
                    operator: "or",
                    value: [
                      {
                        field: "spec->>global",
                        operator: "eq",
                        value: false,
                      },
                      {
                        field: "spec->>global",
                        operator: "null",
                        value: true,
                      },
                    ],
                  },
                ],
              },
            }}
          >
            <Table.Column
              header={t("common.fields.workspace")}
              accessorKey="spec.workspace"
              id="workspace"
              enableHiding
              cell={({ row }) => {
                const { global, workspace } = row.original.spec;
                if (global) return "*";
                return (
                  <ShowButton
                    recordItemId={workspace}
                    meta={{}}
                    variant="link"
                    resource="workspaces"
                  >
                    {workspace}
                  </ShowButton>
                );
              }}
            />
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
            {metadataColumns.creation_timestamp}
          </Table>
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
