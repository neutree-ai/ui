import { useSelect } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { type ReactElement, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { SUBJECT_KIND_KEYS } from "@/domains/role-assignment/components/RoleAssignmentSubjectLabel";
import { roleAssignmentErrorMessage } from "@/domains/role-assignment/lib/role-assignment-errors";
import {
  availableScopes,
  type RoleAssignmentScope,
  scopeFields,
  scopeOf,
} from "@/domains/role-assignment/lib/scope";
import {
  availableSubjectKinds,
  subjectFields,
  subjectKindOf,
} from "@/domains/role-assignment/lib/subject";
import type {
  RoleAssignment,
  RoleAssignmentSubjectKind,
} from "@/domains/role-assignment/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { FormSelect } from "@/foundation/components/FormSelect";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import {
  useHasGlobalPermission,
  useHasPermission,
} from "@/foundation/hooks/use-has-permission";
import { useLicense } from "@/foundation/hooks/use-license";
import { useTranslation } from "@/foundation/lib/i18n";
import { profileOptionLabel } from "@/foundation/lib/user-identity";
import type { Metadata } from "@/foundation/types/basic-types";

const SCOPE_OPTION_KEYS: Record<RoleAssignmentScope, string> = {
  global: "role_assignments.options.global",
  workspace: "role_assignments.options.workspace",
  org_unit: "role_assignments.options.orgUnit",
};

export const useRoleAssignmentForm = ({
  action,
  orgUnitField,
  teamField,
}: {
  action: "create" | "edit";
  /** The department picker, from the organization domain. */
  orgUnitField?: ReactElement;
  /** The Team picker, from the organization domain. */
  teamField?: ReactElement;
}) => {
  const { t } = useTranslation();
  const { supportMultiWorkspace } = useLicense();
  const permission = `role_assignment:${action === "edit" ? "update" : "create"}`;
  const { allowed: globalAllowed } = useHasGlobalPermission(permission);
  const { allowed: anyScopeAllowed } = useHasPermission(permission);
  const delegated = globalAllowed === false && anyScopeAllowed === true;
  const { allowed: canReadTeams } = useHasGlobalPermission("team:read");

  const form = useForm<RoleAssignment>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "RoleAssignment",
      metadata: {
        name: "",
      },
      spec: {
        user_id: "",
        workspace: "",
        // Not derived from the license: it loads after the first render, so a
        // license-based default differs between the first and later opens.
        global: true,
        role: "",
        org_unit: null,
        subject_kind: "User",
        subject_name: null,
      },
    },
    refineCoreProps: {
      // A known error code gets its own message; anything else keeps
      // refine's default notification.
      errorNotification: (error) => {
        const description = roleAssignmentErrorMessage(t, error);
        return description
          ? {
              type: "error",
              message: t("role_assignments.errors.saveFailed"),
              description,
            }
          : undefined;
      },
    },
    warnWhenUnsavedChanges: true,
  });

  const isEdit = action === "edit";

  const spec = form.watch("spec");
  const scope = scopeOf(spec);
  const scopes = availableScopes({
    supportMultiWorkspace,
    delegated,
  });

  const subjectKind = subjectKindOf(spec);
  const subjectKinds = availableSubjectKinds({
    delegated,
    canReadTeams: canReadTeams === true && !!teamField,
  }).filter((kind) => kind !== "OrgUnit" || !!orgUnitField);
  // An existing assignment keeps its kind on the list, e.g. a Team one
  // opened by someone who cannot list teams.
  if (!subjectKinds.includes(subjectKind)) subjectKinds.push(subjectKind);

  const groupField =
    subjectKind === "Team"
      ? teamField
      : subjectKind === "OrgUnit"
        ? orgUnitField
        : undefined;

  // All three subject fields are written: a composite PATCH nulls the ones
  // it leaves out.
  const setSubjectKind = (next: RoleAssignmentSubjectKind) => {
    const fields = subjectFields(next, form.getValues("spec"));
    form.setValue("spec.subject_kind", fields.subject_kind, {
      shouldDirty: true,
    });
    form.setValue("spec.subject_name", fields.subject_name, {
      shouldDirty: true,
    });
    form.setValue("spec.user_id", fields.user_id, { shouldDirty: true });
  };

  const setScope = (next: RoleAssignmentScope) => {
    const fields = scopeFields(next, form.getValues("spec"));
    form.setValue("spec.global", fields.global, { shouldDirty: true });
    form.setValue("spec.workspace", fields.workspace, { shouldDirty: true });
    form.setValue("spec.org_unit", fields.org_unit, { shouldDirty: true });
  };

  // A delegated administrator can grant subtree assignments only, so a new
  // one starts there. The permission check resolves after the defaults.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the permission resolves.
  useEffect(() => {
    if (
      delegated &&
      !isEdit &&
      scopeOf(form.getValues("spec")) !== "org_unit"
    ) {
      setScope("org_unit");
    }
  }, [delegated, isEdit]);

  const users = useSelect<{ id: number; metadata: Metadata }>({
    resource: "user_profiles",
  });

  const roles = useSelect<{ id: number; metadata: Metadata }>({
    resource: "roles",
  });

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("common.sections.basicInformation")}>
        <FormFieldGroup
          {...form}
          name="metadata.name"
          label={t("common.fields.name")}
        >
          <Input
            placeholder={t("role_assignments.placeholders.policyName")}
            disabled={isEdit}
          />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid title={t("role_assignments.fields.policy")}>
        <FormFieldGroup
          {...form}
          name="spec.subject_kind"
          label={t("role_assignments.fields.subjectKind")}
        >
          <FormSelect
            disabled={subjectKinds.length < 2}
            value={subjectKind}
            options={subjectKinds.map((value) => ({
              label: t(SUBJECT_KIND_KEYS[value]),
              value,
            }))}
            onChange={(value) => {
              const next = subjectKinds.find((item) => item === value);
              if (next) setSubjectKind(next);
            }}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.user_id"
          label={t("common.fields.user")}
          className={subjectKind === "User" ? "" : "hidden"}
          rules={{
            validate: (value) =>
              subjectKindOf(form.getValues("spec")) !== "User" ||
              !!value ||
              t("role_assignments.validation.userRequired"),
          }}
        >
          <FormCombobox
            placeholder={t("role_assignments.placeholders.selectUser")}
            disabled={users.query.isLoading}
            options={(users.query.data?.data || []).map((e) => ({
              label: profileOptionLabel(e.metadata),
              value: e.id,
            }))}
          />
        </FormFieldGroup>
        {groupField && (
          <FormFieldGroup
            {...form}
            // Remounts the picker when the kind changes: Team and department
            // share spec.subject_name.
            key={subjectKind}
            name="spec.subject_name"
            label={
              subjectKind === "Team"
                ? t("role_assignments.subjectKinds.Team")
                : t("organization.fields.department")
            }
            rules={{
              validate: (value) => {
                if ((value ?? "").trim() !== "") return true;
                return subjectKind === "Team"
                  ? t("role_assignments.validation.teamRequired")
                  : t("role_assignments.validation.orgUnitRequired");
              },
            }}
          >
            {groupField}
          </FormFieldGroup>
        )}
        <FormFieldGroup
          {...form}
          name="spec.role"
          label={t("common.fields.role")}
        >
          <FormCombobox
            placeholder={t("role_assignments.placeholders.selectRole")}
            disabled={roles.query.isLoading}
            options={(roles.query.data?.data || []).map((e) => ({
              label: e.metadata.name,
              value: e.metadata.name,
            }))}
          />
        </FormFieldGroup>
        <div />
        <FormFieldGroup
          {...form}
          name="spec.global"
          label={t("role_assignments.fields.policyScope")}
          description={t("role_assignments.descriptions.policyScope")}
        >
          <FormSelect
            disabled={scopes.length < 2}
            value={scope}
            options={scopes.map((value) => ({
              label: t(SCOPE_OPTION_KEYS[value]),
              value,
            }))}
            onChange={(value) => {
              // Radix reports "" when the value leaves the options.
              const next = scopes.find((item) => item === value);
              if (next) setScope(next);
            }}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.workspace"
          label={t("common.fields.workspace")}
          className={scope === "workspace" ? "" : "hidden"}
          rules={{
            validate: (value) =>
              scopeOf(form.getValues("spec")) !== "workspace" ||
              (value ?? "").trim() !== "" ||
              t("role_assignments.validation.workspaceRequired"),
          }}
        >
          <WorkspaceField />
        </FormFieldGroup>
        {orgUnitField && (
          <FormFieldGroup
            {...form}
            name="spec.org_unit"
            label={t("role_assignments.fields.subtreeRoot")}
            className={scope === "org_unit" ? "" : "hidden"}
            rules={{
              validate: (value) =>
                typeof value !== "string" ||
                value.trim() !== "" ||
                t("role_assignments.validation.orgUnitRequired"),
            }}
          >
            {orgUnitField}
          </FormFieldGroup>
        )}
      </FormCardGrid>
    ),
  };
};
