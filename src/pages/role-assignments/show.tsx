import { useShow } from "@refinedev/core";
import { OrgUnitLabel } from "@/domains/organization/components/OrgUnitField";
import { TeamLabel } from "@/domains/organization/components/TeamField";
import { RoleAssignmentScopeLabel } from "@/domains/role-assignment/components/RoleAssignmentScopeLabel";
import { RoleAssignmentSubjectLabel } from "@/domains/role-assignment/components/RoleAssignmentSubjectLabel";
import type { RoleAssignment } from "@/domains/role-assignment/types";
import { ServiceAccountLabel } from "@/domains/service-account/components/ServiceAccountLabel";
import { Loader } from "@/foundation/components/Loader";
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

  const subject = (
    <RoleAssignmentSubjectLabel
      spec={record.spec}
      renderTeam={(name) => <TeamLabel name={name} />}
      renderOrgUnit={(name) => <OrgUnitLabel name={name} />}
      renderServiceAccount={(id) => <ServiceAccountLabel id={id} />}
    />
  );

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
            <ShowPage.Meta label={t("role_assignments.fields.scope")}>
              <RoleAssignmentScopeLabel
                spec={record.spec}
                renderOrgUnit={(name) => <OrgUnitLabel name={name} />}
                renderTeam={(name) => <TeamLabel name={name} />}
              />
            </ShowPage.Meta>
            <ShowPage.Meta label={t("common.fields.role")}>
              {record.spec.role}
            </ShowPage.Meta>
            <ShowPage.Meta label={t("role_assignments.fields.subject")}>
              {subject}
            </ShowPage.Meta>
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
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
            <ShowPage.Row title={t("role_assignments.fields.subject")}>
              {subject}
            </ShowPage.Row>
          </div>
        </ShowPage.Section>
      </div>
    </ShowPage>
  );
};
