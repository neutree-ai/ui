import MetadataCard from "@/components/business/MetadataCard";
import UserCell from "@/components/business/UserCell";
import { ShowButton, ShowPage } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { Card, CardContent } from "@/components/ui/card";
import type { RoleAssignment } from "@/types";
import { useShow } from "@refinedev/core";

export const RoleAssignmentsShow = () => {
  const {
    query: { data, isLoading },
  } = useShow<RoleAssignment>();
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>404 not found</div>;
  }

  return (
    <ShowPage record={record}>
      <MetadataCard metadata={record.metadata} />
      <Card className="mt-4">
        <CardContent>
          <div className="grid grid-cols-4 gap-8">
            <ShowPage.Row title="Workspace">
              {record.spec.global ? (
                "*"
              ) : (
                <ShowButton
                  recordItemId={record.spec.workspace!}
                  meta={{}}
                  variant="link"
                  resource="workspaces"
                >
                  {record.spec.workspace}
                </ShowButton>
              )}
            </ShowPage.Row>
            <ShowPage.Row title="Role">
              <ShowButton
                recordItemId={record.spec.role}
                meta={{}}
                variant="link"
                resource="roles"
              >
                {record.spec.role}
              </ShowButton>
            </ShowPage.Row>
            <ShowPage.Row title="User">
              <UserCell id={record.spec.user_id} />
            </ShowPage.Row>
          </div>
        </CardContent>
      </Card>
    </ShowPage>
  );
};
