import { useShow } from "@refinedev/core";
import { OrgUnitLabel } from "@/domains/organization/components/OrgUnitField";
import { TeamLabel } from "@/domains/organization/components/TeamField";
import { roleAssignmentFields } from "@/domains/role-assignment/lib/detail-fields";
import type { RoleAssignment } from "@/domains/role-assignment/types";
import { Loader } from "@/foundation/components/Loader";
import { useTranslation } from "@/foundation/lib/i18n";
import { DetailFields } from "@/foundation/scene/DetailFields";
import { MetadataTimestampMeta } from "@/foundation/scene/MetadataTimestampMeta";
import { ShowPage } from "@/foundation/scene/ShowPage";

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

  const fields = roleAssignmentFields({
    renderTeam: (name) => <TeamLabel name={name} />,
    renderOrgUnit: (name) => <OrgUnitLabel name={name} />,
  });

  const isAdminGlobalAssignment =
    record.metadata.name === "admin-global-role-assignment";

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
            <DetailFields inline fields={fields.header} record={record} />
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
        <ShowPage.Section title={t("role_assignments.fields.policy")}>
          <DetailFields fields={fields.policy} record={record} />
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
