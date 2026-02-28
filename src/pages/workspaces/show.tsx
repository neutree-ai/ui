import { Loader } from "@/components/business/Loader";
import MetadataCard from "@/components/business/MetadataCard";
import { ShowPage } from "@/components/business/ShowPage";
import { Table } from "@/components/business/Table";
import { useMetadataColumns } from "@/components/business/metadata-columns";
import { useRoleAssignmentColumns } from "@/components/business/role-assignment-columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Workspace } from "@/types";
import { useShow, useTranslation } from "@refinedev/core";

export const WorkspacesShow = () => {
  const {
    query: { data, isLoading },
  } = useShow<Workspace>();
  const record = data?.data;
  const metadataColumns = useMetadataColumns({ resource: "role_assignments" });
  const roleAssignmentColumns = useRoleAssignmentColumns();

  const { translate } = useTranslation();

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{translate("pages.error.notFound")}</div>;
  }

  const { metadata } = record;

  return (
    <ShowPage record={record} canEdit={false}>
      <MetadataCard metadata={metadata} />
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{translate("role_assignments.title")}</CardTitle>
        </CardHeader>
        <CardContent>
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
            {roleAssignmentColumns.role}
            {roleAssignmentColumns.user}
            {metadataColumns.update_timestamp}
            {metadataColumns.creation_timestamp}
          </Table>
        </CardContent>
      </Card>
    </ShowPage>
  );
};
