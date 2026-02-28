import { Card, CardContent } from "@/components/ui/card";
import UserCell from "@/domains/role-assignment/components/UserCell";
import type { RoleAssignment } from "@/domains/role-assignment/types";
import { Loader } from "@/foundation/components/Loader";
import MetadataCard from "@/foundation/components/MetadataCard";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";
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
            <ShowPage.Row title={t("common.fields.workspace")}>
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
            <ShowPage.Row title={t("common.fields.role")}>
              <ShowButton
                recordItemId={record.spec.role}
                meta={{}}
                variant="link"
                resource="roles"
              >
                {record.spec.role}
              </ShowButton>
            </ShowPage.Row>
            <ShowPage.Row title={t("common.fields.user")}>
              <UserCell id={record.spec.user_id} />
            </ShowPage.Row>
          </div>
        </CardContent>
      </Card>
    </ShowPage>
  );
};
