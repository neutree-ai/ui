import { translateApiError } from "@/foundation/lib/api-error-code";

/** Group policy write errors → i18n keys, from the write trigger of migration 122. */
const GROUP_POLICY_ERROR_KEYS: Readonly<Record<string, string>> = {
  "10294": "group_policies.errors.groupNotFound",
  "10299": "group_policies.errors.workspaceNotAllowed",
  "10300": "group_policies.errors.invalidSubjectKind",
  "10301": "group_policies.errors.groupFixed",
  "10302": "group_policies.errors.invalidModels",
  "23505": "group_policies.errors.alreadyExists",
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const groupPolicyErrorMessage = (
  t: Translate,
  error: unknown,
): string | undefined => translateApiError(t, error, GROUP_POLICY_ERROR_KEYS);
