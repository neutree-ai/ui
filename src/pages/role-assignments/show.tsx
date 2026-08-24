import { useShow } from "@refinedev/core";
import UserCell from "@/domains/role-assignment/components/UserCell";
import type { RoleAssignment } from "@/domains/role-assignment/types";
import { Loader } from "@/foundation/components/Loader";
import { MetadataDisclosure } from "@/foundation/components/MetadataDisclosure";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import { useTranslation } from "@/foundation/lib/i18n";

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
  const workspaceValue = record.spec.global ? "*" : record.spec.workspace;

  return (
    <ShowPage
      record={record}
      canDelete={!isAdminGlobalAssignment}
      canEdit={!isAdminGlobalAssignment}
      showCurrentBreadcrumb={false}
    >
      <ShowPage.ObjectHeader
        title={record.metadata.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <ShowPage.Meta label={t("common.fields.workspace")}>
              {workspaceValue || "-"}
            </ShowPage.Meta>
            <ShowPage.Meta label={t("common.fields.role")}>
              {record.spec.role}
            </ShowPage.Meta>
            <ShowPage.Meta label={t("common.fields.user")}>
              <UserCell id={record.spec.user_id} />
            </ShowPage.Meta>
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
        <MetadataDisclosure metadata={record.metadata} />
        <ShowPage.Section title={t("role_assignments.fields.policy")}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
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
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
