import { useParsed, useShow } from "@refinedev/core";
import {
  USER_MODEL_ACCESS_WORKSPACE_PARAM,
  UserGroupModelAccess,
} from "@/domains/group-policy/components/UserGroupModelAccess";
import { OrgUnitLabel } from "@/domains/organization/components/OrgUnitField";
import { TeamLabel } from "@/domains/organization/components/TeamField";
import {
  UserDepartmentSection,
  UserTeamsSection,
} from "@/domains/organization/components/UserOrganization";
import { UserEffectiveRoleAssignments } from "@/domains/role-assignment/components/UserEffectiveRoleAssignments";
import type { UserProfile } from "@/domains/user/types";
import { EmptyValue } from "@/foundation/components/EmptyValue";
import { Loader } from "@/foundation/components/Loader";
import { MetadataTimestampMeta } from "@/foundation/components/MetadataTimestampMeta";
import { useMetadataColumns } from "@/foundation/components/metadata-columns";
import { ShowButton } from "@/foundation/components/ShowButton";
import { ShowPage } from "@/foundation/components/ShowPage";
import { Table } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  profileDisplayName,
  profileEmail,
  profileIdentitySourceName,
} from "@/foundation/lib/user-identity";

export const UsersShow = () => {
  const { t } = useTranslation();
  const {
    query: { data, isLoading },
  } = useShow<UserProfile>();
  const record = data?.data;
  const { params } = useParsed<Record<string, string | undefined>>();

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
        title={profileDisplayName(record.metadata)}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <ShowPage.Meta label={t("common.fields.name")}>
              {record.metadata.name}
            </ShowPage.Meta>
            <ShowPage.Meta label={t("common.fields.email")}>
              {profileEmail(record) || <EmptyValue />}
            </ShowPage.Meta>
            <ShowPage.Meta label={t("user_profiles.fields.identitySource")}>
              <span data-testid="user-identity-source">
                {profileIdentitySourceName(record.metadata) ||
                  t("user_profiles.values.local")}
              </span>
            </ShowPage.Meta>
            <MetadataTimestampMeta metadata={record.metadata} />
          </span>
        }
      />
      <div className="mt-4 space-y-3">
        <UserDepartmentSection profile={record} />
        <UserTeamsSection userId={record.id} />
        <UserEffectiveRoleAssignments
          userId={record.id}
          renderTeam={(name) => <TeamLabel name={name} />}
          renderOrgUnit={(name) => <OrgUnitLabel name={name} />}
        />
        <UserGroupModelAccess
          userId={record.id}
          initialWorkspace={params?.[USER_MODEL_ACCESS_WORKSPACE_PARAM]}
          renderTeam={(name, label) => (
            <TeamLabel name={name} fallback={label} />
          )}
          renderOrgUnit={(name, label) => (
            <OrgUnitLabel name={name} fallback={label} />
          )}
        />
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
                  {
                    field: "spec->>org_unit",
                    operator: "null",
                    value: true,
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
        <ShowPage.Section
          title={t("user_profiles.sections.departmentRoles")}
          data-testid="department-roles-card"
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
                    field: "spec->>org_unit",
                    operator: "nnull",
                    value: null,
                  },
                ],
              },
            }}
          >
            <Table.Column
              header={t("organization.fields.department")}
              accessorKey="spec.org_unit"
              id="org_unit"
              enableHiding
              cell={({ row }) => (
                <OrgUnitLabel name={row.original.spec.org_unit} />
              )}
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
