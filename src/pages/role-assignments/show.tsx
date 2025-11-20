import MetadataCard from "@/components/business/MetadataCard";
import UserCell from "@/components/business/UserCell";
import { ShowButton, ShowPage } from "@/components/theme";
import Loader from "@/components/theme/components/loader";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import type { RoleAssignment } from "@/types";
import { useShow } from "@refinedev/core";

export const RoleAssignmentsShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<RoleAssignment>();
  const record = data?.data;

  if (isLoading) {
    return <Loader className="h-4 text-primary" />;
  }

  if (!record) {
    return <div>{t("pages.error.notFound")}</div>;
  }

  const isAdminGlobalAssignment =
    record.metadata.name === "admin-global-role-assignment";

  return (
    <ShowPage
      record={record}
      canDelete={!isAdminGlobalAssignment}
      canEdit={!isAdminGlobalAssignment}
    >
      <MetadataCard metadata={record.metadata} />
      <Card className="mt-4">
        <CardContent>
          <div className="grid grid-cols-4 gap-8">
            <ShowPage.Row title={t("role_assignments.fields.workspace")}>
              {record.spec.global ? (
                "*"
              ) : record.spec.workspace ? (
                <ShowButton
                  recordItemId={record.spec.workspace}
                  meta={{}}
                  variant="link"
                  resource="workspaces"
                >
                  {record.spec.workspace}
                </ShowButton>
              ) : null}
            </ShowPage.Row>
            <ShowPage.Row title={t("role_assignments.fields.role")}>
              <ShowButton
                recordItemId={record.spec.role}
                meta={{}}
                variant="link"
                resource="roles"
              >
                {record.spec.role}
              </ShowButton>
            </ShowPage.Row>
            <ShowPage.Row title={t("role_assignments.fields.user")}>
              <UserCell id={record.spec.user_id} />
            </ShowPage.Row>
          </div>
        </CardContent>
      </Card>
    </ShowPage>
  );
};
