import { translateApiError } from "@/foundation/lib/api-error-code";

/**
 * Role assignment write errors → i18n keys. 10041, 10280-10282 and
 * 10292-10294 come from the community write triggers, 10283-10286 and 10297
 * from the enterprise checks on delegated grants.
 */
const ROLE_ASSIGNMENT_ERROR_KEYS: Readonly<Record<string, string>> = {
  "10041": "role_assignments.errors.workspaceUnsupported",
  "10280": "role_assignments.errors.orgUnitUnsupported",
  "10281": "role_assignments.errors.orgUnitScopeConflict",
  "10282": "role_assignments.errors.orgUnitNotFound",
  "10283": "role_assignments.errors.delegatedOrgUnitOnly",
  "10284": "role_assignments.errors.outsideScope",
  "10285": "role_assignments.errors.roleNotFound",
  "10286": "role_assignments.errors.roleExceedsGrant",
  "10292": "role_assignments.errors.invalidSubjectKind",
  "10293": "role_assignments.errors.subjectMismatch",
  "10294": "role_assignments.errors.subjectNotFound",
  "10297": "role_assignments.errors.delegatedNoTeam",
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const roleAssignmentErrorMessage = (
  t: Translate,
  error: unknown,
): string | undefined =>
  translateApiError(t, error, ROLE_ASSIGNMENT_ERROR_KEYS);
