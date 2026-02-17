import MetadataCard from "@/components/business/MetadataCard";
import { ShowButton, ShowPage, Table } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useRoleAssignmentColumns } from "@/components/theme/table/columns/role-assignment-columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import type { UserProfile } from "@/types";
import { useShow } from "@refinedev/core";

export const UsersShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<UserProfile>();
  const record = data?.data;

  const metadataColumns = useMetadataColumns();
  const roleAssignmentColumns = useRoleAssignmentColumns();

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  return (
    <ShowPage record={record}>
      <MetadataCard metadata={record.metadata} />
      <Card className="mt-4">
        <CardContent className="pt-6">
          <ShowPage.Row
            title={t("common.fields.email")}
            children={record.spec.email}
          />
        </CardContent>
      </Card>
      <Card className="mt-4" data-testid="global-roles-card">
        <CardHeader>
          <CardTitle>{t("user_profiles.sections.globalRoles")}</CardTitle>
        </CardHeader>
        <CardContent>
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
            {roleAssignmentColumns.role}
            {metadataColumns.creation_timestamp}
          </Table>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("user_profiles.sections.joinedWorkspaces")}</CardTitle>
        </CardHeader>
        <CardContent>
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
            {roleAssignmentColumns.workspace}
            {roleAssignmentColumns.role}
            {metadataColumns.creation_timestamp}
          </Table>
        </CardContent>
      </Card>
    </ShowPage>
  );
};
