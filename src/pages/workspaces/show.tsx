import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRoleAssignmentColumns } from "@/domains/role-assignment/columns";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowPage } from "@/foundation/components/ShowPage";
import { Table } from "@/foundation/components/Table";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import type { Workspace } from "@/foundation/types";
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
